import { css } from '@emotion/css';
import React from 'react';

import { FieldConfigOptionsRegistry, GrafanaTheme2, ConfigOverrideRule } from '@grafana/data';
import { HorizontalGroup, Icon, IconButton, useStyles2 } from '@grafana/ui';
import { FieldMatcherUIRegistryItem } from '@grafana/ui/src/components/MatchersUI/types';

interface Props {
  isExpanded: boolean;
  registry: FieldConfigOptionsRegistry;
  matcherUi: FieldMatcherUIRegistryItem<any>;
  override: ConfigOverrideRule;
  overrideName: string;
  onOverrideRemove: () => void;
}
export const OverrideCategoryTitle = ({
  isExpanded,
  registry,
  matcherUi,
  overrideName,
  override,
  onOverrideRemove,
}: Props) => {
  const styles = useStyles2(getStyles);
  const properties = override.properties.map((p) => registry.getIfExists(p.id)).filter((prop) => !!prop);
  const propertyNames = properties.map((p) => p?.name).join(', ');
  const matcherOptions = matcherUi.optionsToLabel(override.matcher.options);

  return (
    <div>
      <HorizontalGroup justify="space-between">
        <div>{overrideName}</div>
        <IconButton name="trash-alt" onClick={onOverrideRemove} tooltip="Remove override" />
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    matcherUi: css`
      padding: ${theme.spacing(1)};
    `,
    propertyPickerWrapper: css`
      margin-top: ${theme.spacing(2)};
    `,
    overrideDetails: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
      font-weight: ${theme.typography.fontWeightRegular};
    `,
    options: css`
      overflow: hidden;
      padding-right: ${theme.spacing(4)};
    `,
    unknownLabel: css`
      margin-bottom: 0;
    `,
  };
};
