import { css } from '@emotion/css';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { ConfigDescriptionLink, ConfigSubSection } from '@grafana/plugin-ui';
import { InlineField, InlineFieldRow, Input, useStyles2 } from '@grafana/ui';

export interface TagLimitOptions extends DataSourceJsonData {
  tagLimit?: number;
}

interface Props extends DataSourcePluginOptionsEditorProps<TagLimitOptions> {}

export default function TagLimitSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={css({ width: '100%' })}>
      <InlineFieldRow className={styles.row}>
        <InlineField
          label="Max tags and tag values"
          labelWidth={26}
          tooltip="Specify the max number of tags and tag values to display in the Tempo editor. Default: 5000"
        >
          <Input
            type="number"
            placeholder="5000"
            onChange={(v) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tagLimit', v.currentTarget.value)
            }
            value={options.jsonData.tagLimit || ''}
            width={40}
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}

export const TagLimitSection = ({ options, onOptionsChange }: DataSourcePluginOptionsEditorProps) => {
  return (
    <ConfigSubSection
      title="Tag limit"
      description={
        <ConfigDescriptionLink
          description="Specify the limit for tags and tag values."
          suffix={'tempo/configure-tempo-data-source/#tag-limit'}
          feature="the tag limit"
        />
      }
    >
      <TagLimitSettings options={options} onOptionsChange={onOptionsChange} />
    </ConfigSubSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  infoText: css({
    label: 'infoText',
    paddingBottom: theme.spacing(2),
    color: theme.colors.text.secondary,
  }),
  row: css({
    label: 'row',
    alignItems: 'baseline',
  }),
});
