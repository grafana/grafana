import React from 'react';
import { Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { DataFrame, FieldConfigPropertyItem, getFieldDisplayName, GrafanaTheme2 } from '@grafana/data';
import { get as lodashGet } from 'lodash';
import { css } from '@emotion/css';

export interface Props {
  overrides: OptionPaneItemOverrideInfo[];
}

export function OptionsPaneItemOverrides({ overrides }: Props) {
  const theme = useTheme2();

  return (
    <>
      {overrides.map((override, index) => (
        <Tooltip content={override.tooltip} key={index.toString()}>
          <div
            aria-label={override.description}
            style={{
              backgroundColor: theme.colors[override.color].main,
              width: 8,
              height: 8,
              borderRadius: '50%',
              marginLeft: theme.spacing(1),
              position: 'relative',
              top: '-1px',
            }}
          />
        </Tooltip>
      ))}
    </>
  );
}

export interface OptionPaneItemOverrideInfo {
  color: 'primary' | 'warning';
  onClick?: () => void;
  tooltip: () => React.ReactElement;
  description: string;
}

export const dataOverrideTooltipDescription = 'Data contains fields with configuration that overrides this default';

export function searchForDataOverrides(
  fieldOption: FieldConfigPropertyItem,
  frames?: DataFrame[]
): OptionPaneItemOverrideInfo[] {
  const overrides: OptionPaneItemOverrideInfo[] = [];
  const hits: Array<{ fieldName: string; value: any }> = [];

  if (!frames) {
    return overrides;
  }

  for (const frame of frames) {
    for (const field of frame.fields) {
      const value = lodashGet(field.config, fieldOption.path);
      if (value == null) {
        continue;
      }

      hits.push({ fieldName: getFieldDisplayName(field, frame, frames), value: value });
    }
  }

  if (hits.length > 0) {
    overrides.push({
      color: 'warning',
      description: dataOverrideTooltipDescription,
      tooltip: function TooltipContent() {
        const styles = useStyles2(getStyles);

        return (
          <div>
            <span>${dataOverrideTooltipDescription}</span>
            <table className={styles.tooltipTable}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((hit, index) => (
                  <tr key={index}>
                    <td>{hit.fieldName}</td>
                    <td>{hit.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      },
    });
  }

  return overrides;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tooltipTable: css`
      width: 'auto';
      margin: ${theme.spacing(0.5, 0)};

      thead th {
        border-bottom: 1px solid ${theme.colors.border.strong};
        padding: ${theme.spacing(0.25, 1)};
      }

      tbody td {
        padding: ${theme.spacing(0.25, 1)};
      }
    `,
  };
};
