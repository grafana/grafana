import { css } from '@emotion/css';
import React, { FC } from 'react';

import { FieldConfigOptionsRegistry, GrafanaTheme, ConfigOverrideRule } from '@grafana/data';
import { HorizontalGroup, Icon, IconButton, useStyles } from '@grafana/ui';
import { FieldMatcherUIRegistryItem } from '@grafana/ui/src/components/MatchersUI/types';

interface OverrideCategoryTitleProps {
  isExpanded: boolean;
  registry: FieldConfigOptionsRegistry;
  matcherUi: FieldMatcherUIRegistryItem<any>;
  override: ConfigOverrideRule;
  overrideName: string;
  onOverrideRemove: () => void;
}
export const OverrideCategoryTitle: FC<OverrideCategoryTitleProps> = ({
  isExpanded,
  registry,
  matcherUi,
  overrideName,
  override,
  onOverrideRemove,
}) => {
  const styles = useStyles(getStyles);
  const properties = override.properties.map((p) => registry.getIfExists(p.id)).filter((prop) => !!prop);
  const propertyNames = properties.map((p) => p?.name).join(', ');
  const matcherOptions = matcherUi.optionsToLabel(override.matcher.options);

  return (
    <div>
      <HorizontalGroup justify="space-between">
        <div>{overrideName}</div>
        <IconButton name="trash-alt" onClick={onOverrideRemove} title="Remove override" />
      </HorizontalGroup>
      {!isExpanded && (
        <div className={styles.overrideDetails}>
          <div className={styles.options} title={matcherOptions}>
            {matcherOptions} <Icon name="angle-right" /> {propertyNames}
          </div>
        </div>
      )}
    </div>
  );
};

OverrideCategoryTitle.displayName = 'OverrideTitle';

const getStyles = (theme: GrafanaTheme) => {
  return {
    matcherUi: css`
      padding: ${theme.spacing.sm};
    `,
    propertyPickerWrapper: css`
      margin-top: ${theme.spacing.formSpacingBase * 2}px;
    `,
    overrideDetails: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
      font-weight: ${theme.typography.weight.regular};
    `,
    options: css`
      overflow: hidden;
      padding-right: ${theme.spacing.xl};
    `,
    unknownLabel: css`
      margin-bottom: 0;
    `,
  };
};
