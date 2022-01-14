import React, { FC } from 'react';
import { cx } from 'emotion';
import { Icon, useStyles } from '@grafana/ui';
import { getStyles } from './ResourcesBar.styles';
import { ResourcesBarProps } from './ResourcesBar.types';
import { formatResources, getResourcesWidth } from './ResourcesBar.utils';
import { Messages } from './ResourcesBar.messages';

export const ResourcesBar: FC<ResourcesBarProps> = ({
  total,
  allocated,
  expected,
  resourceLabel,
  units,
  icon,
  dataQa,
  className,
}) => {
  const styles = useStyles(getStyles);
  const requiredResources = allocated && expected ? allocated + expected : undefined;
  const allocatedWidth = getResourcesWidth(allocated, total);
  const expectedWidth = getResourcesWidth(requiredResources, total);
  const isResourceInsufficient = requiredResources && total ? requiredResources > total : false;

  return (
    <div data-qa={dataQa} className={cx(styles.resourcesBarWrapper, className)}>
      <div data-qa="resources-bar-icon" className={styles.iconWrapper}>
        {icon}
      </div>
      <div className={styles.resourcesBarContent}>
        <div data-qa="resources-bar" className={styles.resourcesBarBackground}>
          {isResourceInsufficient ? (
            <div className={cx(styles.filled, styles.filledInsufficient, styles.getFilledStyles(100))} />
          ) : (
            expected && (
              <div className={cx(styles.filled, styles.filledExpected, styles.getFilledStyles(expectedWidth))} />
            )
          )}
          {allocated && (
            <div className={cx(styles.filled, styles.filledAllocated, styles.getFilledStyles(allocatedWidth))} />
          )}
        </div>
        {allocated && total && (
          <span data-qa="resources-bar-label" className={styles.resourcesBarLabel}>
            {Messages.buildResourcesLabel(formatResources(allocated), allocatedWidth, formatResources(total), units)}
          </span>
        )}
        {isResourceInsufficient ? (
          <div className={styles.captionWrapper}>
            <Icon className={styles.insufficientIcon} name="exclamation-triangle" />
            <span data-qa="resources-bar-insufficient-resources" className={styles.captionLabel}>
              {Messages.buildInsufficientLabel(resourceLabel)}
            </span>
          </div>
        ) : (
          <>
            {allocated && (
              <div className={styles.captionWrapper}>
                <div className={cx(styles.captionSquare, styles.allocatedSquare)}></div>
                <span data-qa="resources-bar-allocated-caption" className={styles.captionLabel}>
                  {Messages.buildAllocatedLabel(resourceLabel)}
                </span>
              </div>
            )}
            {expected && (
              <div className={styles.captionWrapper}>
                <div className={cx(styles.captionSquare, styles.expectedSquare)}></div>
                <span data-qa="resources-bar-expected-caption" className={styles.captionLabel}>
                  {Messages.buildExpectedLabel(formatResources(expected), resourceLabel, units)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
