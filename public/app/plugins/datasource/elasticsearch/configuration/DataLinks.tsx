import { css } from '@emotion/css';

import { GrafanaTheme2, VariableOrigin, DataLinkBuiltInVars } from '@grafana/data';
import { ConfigDescriptionLink, ConfigSubSection } from '@grafana/experimental';
import { Button, useStyles2 } from '@grafana/ui';

import { DataLinkConfig } from '../types';

import { DataLink } from './DataLink';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    addButton: css({
      marginRight: '10px',
    }),
    container: css({
      marginBottom: theme.spacing(2),
    }),
    dataLink: css({
      marginBottom: theme.spacing(1),
    }),
  };
};

export type Props = {
  value?: DataLinkConfig[];
  onChange: (value: DataLinkConfig[]) => void;
};
export const DataLinks = (props: Props) => {
  const { value, onChange } = props;
  const styles = useStyles2(getStyles);

  return (
    <ConfigSubSection
      title="Data links"
      description={
        <ConfigDescriptionLink
          description="Add links to existing fields. Links will be shown in log row details next to the field value."
          suffix="elasticsearch/#data-links"
          feature="Elasticsearch data links"
        />
      }
    >
      <div className={styles.container}>
        {value && value.length > 0 && (
          <div className="gf-form-group">
            {value.map((field, index) => {
              return (
                <DataLink
                  className={styles.dataLink}
                  key={index}
                  value={field}
                  onChange={(newField) => {
                    const newDataLinks = [...value];
                    newDataLinks.splice(index, 1, newField);
                    onChange(newDataLinks);
                  }}
                  onDelete={() => {
                    const newDataLinks = [...value];
                    newDataLinks.splice(index, 1);
                    onChange(newDataLinks);
                  }}
                  suggestions={[
                    {
                      value: DataLinkBuiltInVars.valueRaw,
                      label: 'Raw value',
                      documentation: 'Raw value of the field',
                      origin: VariableOrigin.Value,
                    },
                  ]}
                />
              );
            })}
          </div>
        )}

        <Button
          type="button"
          variant={'secondary'}
          className={styles.addButton}
          icon="plus"
          onClick={(event) => {
            event.preventDefault();
            const newDataLinks = [...(value || []), { field: '', url: '' }];
            onChange(newDataLinks);
          }}
        >
          Add
        </Button>
      </div>
    </ConfigSubSection>
  );
};
