import { css } from '@emotion/css';

import { type FieldConfigOptionsRegistry, type GrafanaTheme2, type ConfigOverrideRule } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack, Icon, useStyles2 } from '@grafana/ui';
import { type FieldMatcherUIRegistryItem } from '@grafana/ui/internal';

interface Props {
  isExpanded: boolean;
  overrideName: string;
  onOverrideRemove: () => void;
  /**
   * Field overrides pass the rule, its registry and matcher UI, and the label is derived here.
   * Item overrides resolve their own label because their matcher registry is per-kind, so they
   * pass {@link matcherLabel} and {@link propertyNames} directly instead.
   */
  registry?: FieldConfigOptionsRegistry;
  matcherUi?: FieldMatcherUIRegistryItem<ConfigOverrideRule>;
  override?: ConfigOverrideRule;
  matcherLabel?: string;
  propertyNames?: string[];
}
export const OverrideCategoryTitle = ({
  isExpanded,
  registry,
  matcherUi,
  overrideName,
  override,
  onOverrideRemove,
  matcherLabel,
  propertyNames: propertyNamesFromProps,
}: Props) => {
  const styles = useStyles2(getStyles);

  const propertyNames = (
    propertyNamesFromProps ??
    (override ?? { properties: [] }).properties
      .map((p) => registry?.getIfExists(p.id))
      .filter((prop) => !!prop)
      .map((p) => p.name)
  ).join(', ');

  // Fall back to the raw matcher id when the matcher type is unknown
  const matcherOptions =
    matcherLabel ??
    (matcherUi && override ? matcherUi.optionsToLabel(override.matcher.options) : override?.matcher.id) ??
    '';

  return (
    <div>
      <Stack justifyContent="space-between">
        <div>{overrideName}</div>
        <Button
          variant="secondary"
          fill="text"
          icon="trash-alt"
          onClick={onOverrideRemove}
          tooltip={t('dashboard.override-category-title.tooltip-remove-override', 'Remove override')}
          aria-label={t('dashboard.override-category-title.aria-label-remove-override', 'Remove override')}
        />
      </Stack>
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
