import React from 'react';
import { Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import {
  DataFrame,
  FieldConfigPropertyItem,
  FieldConfigSource,
  getFieldDisplayName,
  GrafanaTheme2,
} from '@grafana/data';
import { get as lodashGet, isPlainObject } from 'lodash';
import { css } from '@emotion/css';

export interface Props {
  overrides: OptionPaneItemOverrideInfo[];
}

export function OptionsPaneItemOverrides({ overrides }: Props) {
  const theme = useTheme2();

  return (
    <>
      {overrides.map((override, index) => (
        <Tooltip content={override.tooltip} key={index.toString()} placement="top">
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
export const overrideRuleTooltipDescription = 'An override rule overwrites this default';

export function searchForOptionOverrides(
  fieldOption: FieldConfigPropertyItem,
  fieldConfig: FieldConfigSource,
  frames: DataFrame[] | undefined
): OptionPaneItemOverrideInfo[] {
  const infoDots: OptionPaneItemOverrideInfo[] = [];

  // Look for options overriden in data field config
  if (frames) {
    const dataOverrides: Array<{ fieldName: string; value: any }> = [];

    for (const frame of frames) {
      for (const field of frame.fields) {
        const value = lodashGet(field.config, fieldOption.path);
        if (value == null) {
          continue;
        }

        dataOverrides.push({ fieldName: getFieldDisplayName(field, frame, frames), value: value });
      }
    }

    if (dataOverrides.length > 0) {
      infoDots.push({
        color: 'warning',
        description: dataOverrideTooltipDescription,
        tooltip: function TooltipContent() {
          const styles = useStyles2(getStyles);

          return (
            <div>
              <span>{dataOverrideTooltipDescription}</span>
              <table className={styles.tooltipTable}>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {dataOverrides.map((hit, index) => (
                    <tr key={index}>
                      <td>{hit.fieldName}</td>
                      <td>{renderOptionValue(hit.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        },
      });
    }
  }

  // Try to find this option in override rules
  for (const rule of fieldConfig.overrides) {
    for (const prop of rule.properties) {
      if (prop.id === fieldOption.id) {
        infoDots.push({
          color: 'primary',
          description: overrideRuleTooltipDescription,
          tooltip: function TooltipContent() {
            const styles = useStyles2(getStyles);

            return (
              <div>
                <span>{overrideRuleTooltipDescription}</span>
              </div>
            );
          },
        });

        break;
      }
    }
  }

  return infoDots;
}

function renderOptionValue(value: any): React.ReactNode {
  if (!isPlainObject(value)) {
    return value;
  }

  return JSON.stringify(value);
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tooltipTable: css`
      width: 'auto';
      margin: ${theme.spacing(0.5, 0)};

      thead th {
        border-bottom: 1px solid ${theme.colors.border.strong};
        padding: ${theme.spacing(0.25, 1, 0.25, 0)};
      }

      tbody td {
        padding: ${theme.spacing(0.25, 1, 0.25, 0)};
        font-weight: normal;
      }
    `,
  };
};
