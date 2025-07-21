import { css } from '@emotion/css';

import { FieldConfigOptionsRegistry, GrafanaTheme2, ConfigOverrideRule } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, HorizontalGroup, Icon, useStyles2 } from '@grafana/ui';
import { FieldMatcherUIRegistryItem } from '@grafana/ui/internal';

interface Props {
  isExpanded: boolean;
  registry: FieldConfigOptionsRegistry;
  matcherUi: FieldMatcherUIRegistryItem<ConfigOverrideRule>;
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
        <Button
          variant="secondary"
          fill="text"
          icon="trash-alt"
          onClick={onOverrideRemove}
          tooltip={t('dashboard.override-category-title.tooltip-remove-override', 'Remove override')}
          aria-label={t('dashboard.override-category-title.aria-label-remove-override', 'Remove override')}
        />
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
    matcherUi: css({
      padding: theme.spacing(1),
    }),
    propertyPickerWrapper: css({
      marginTop: theme.spacing(2),
    }),
    overrideDetails: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightRegular,
    }),
    options: css({
      overflow: 'hidden',
      paddingRight: theme.spacing(4),
    }),
    unknownLabel: css({
      marginBottom: 0,
    }),
  };
};
