import { cx } from '@emotion/css';
import React, { FC } from 'react';

import { Icon, useStyles } from '@grafana/ui';

import { Messages } from './ResourcesBar.messages';
import { getStyles } from './ResourcesBar.styles';
import { ResourcesBarProps } from './ResourcesBar.types';
import {
  formatResources,
  getExpectedAllocated,
  getExpectedAllocatedWidth,
  getResourcesWidth,
} from './ResourcesBar.utils';

export const ResourcesBar: FC<React.PropsWithChildren<ResourcesBarProps>> = ({
  total,
  allocated,
  expected,
  resourceLabel,
  resourceEmptyValueMessage,
  icon,
  dataTestId,
  className,
}) => {
  const styles = useStyles(getStyles);
  const requiredResources = allocated && expected ? allocated.original + expected.original : undefined;
  const allocatedWidth = getResourcesWidth(allocated?.original, total?.original);
  const expectedWidth = getResourcesWidth(requiredResources, total?.original);
  const expectedAllocatedWidth = getExpectedAllocatedWidth(expected, allocated);
  const expectedAllocated = getExpectedAllocated(expected, allocated);
  const isDownsize = expected && expected.value < 0;
  const isResourceInsufficient = requiredResources && total ? requiredResources > total.original : false;
  const expectedSquareStyles = {
    [styles.expectedSquare]: !isDownsize,
    [styles.expectedAllocatedSquare]: isDownsize,
  };

  return (
    <div data-testid={dataTestId} className={cx(styles.resourcesBarWrapper, className)}>
      <div data-testid="resources-bar-icon" className={styles.iconWrapper}>
        {icon}
      </div>
      <div className={styles.resourcesBarContent}>
        <div data-testid="resources-bar" className={styles.resourcesBarBackground}>
          {isResourceInsufficient ? (
            <div className={cx(styles.filled, styles.filledInsufficient, styles.getFilledStyles(100))} />
          ) : (
            !isDownsize && (
              <div className={cx(styles.filled, styles.filledExpected, styles.getFilledStyles(expectedWidth))} />
            )
          )}
          {allocated && (
            <div className={cx(styles.filled, styles.filledAllocated, styles.getFilledStyles(allocatedWidth))}>
              {isDownsize && (
                <div
                  className={cx(
                    styles.filled,
                    styles.filledExpectedAllocated,
                    styles.getFilledStyles(expectedAllocatedWidth)
                  )}
                />
              )}
            </div>
          )}
        </div>
        {allocated && total && (
          <span data-testid="resources-bar-label" className={styles.resourcesBarLabel}>
            {Messages.buildResourcesLabel(
              formatResources(allocated),
              allocatedWidth,
              formatResources(total),
              resourceEmptyValueMessage
            )}
          </span>
        )}
        {allocated && (
          <div className={styles.captionWrapper}>
            <div className={cx(styles.captionSquare, styles.allocatedSquare)}></div>
            <span data-testid="resources-bar-allocated-caption" className={styles.captionLabel}>
              {Messages.buildAllocatedLabel(resourceLabel)}
            </span>
          </div>
        )}
        {expected && expected.value !== 0 && !isResourceInsufficient && (
          <div className={styles.captionWrapper}>
            <div className={cx(styles.captionSquare, expectedSquareStyles)}></div>
            <span data-testid="resources-bar-expected-caption" className={styles.captionLabel}>
              {isDownsize
                ? Messages.buildExpectedAllocatedLabel(formatResources(expectedAllocated), resourceLabel)
                : Messages.buildExpectedLabel(formatResources(expected), resourceLabel)}
            </span>
          </div>
        )}
        {expected && isResourceInsufficient && (
          <div className={styles.captionWrapper}>
            <Icon className={styles.insufficientIcon} name="exclamation-triangle" />
            <span data-testid="resources-bar-insufficient-resources" className={styles.captionLabel}>
              {Messages.buildInsufficientLabel(formatResources(expected), resourceLabel)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
