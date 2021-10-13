import React from 'react';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { DataFrame, FieldConfigPropertyItem, FieldConfigSource, GrafanaTheme2 } from '@grafana/data';
import { get as lodashGet } from 'lodash';
import { css, CSSObject } from '@emotion/css';

export interface Props {
  overrides: OptionPaneItemOverrideInfo[];
}

export function OptionsPaneItemOverrides({ overrides }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {overrides.map((override, index) => (
        <Tooltip content={override.tooltip} key={index.toString()} placement="top">
          <div aria-label={override.description} className={styles[override.type]} />
        </Tooltip>
      ))}
    </div>
  );
}

export interface OptionPaneItemOverrideInfo {
  type: 'data' | 'rule';
  onClick?: () => void;
  tooltip: () => React.ReactElement;
  description: string;
}

export const dataOverrideTooltipDescription =
  'Some data fields have this option pre-configured. Add a field override rule to override the pre-configured value.';
export const overrideRuleTooltipDescription = 'An override rule exists for this property';

export function searchForOptionOverrides(
  fieldOption: FieldConfigPropertyItem,
  fieldConfig: FieldConfigSource,
  frames: DataFrame[] | undefined
): OptionPaneItemOverrideInfo[] {
  const infoDots: OptionPaneItemOverrideInfo[] = [];

  // Look for options overriden in data field config
  if (frames) {
    for (const frame of frames) {
      for (const field of frame.fields) {
        const value = lodashGet(field.config, fieldOption.path);
        if (value == null) {
          continue;
        }

        infoDots.push({
          type: 'data',
          description: dataOverrideTooltipDescription,
          tooltip: function TooltipContent() {
            return (
              <div>
                <div>{dataOverrideTooltipDescription}</div>
              </div>
            );
          },
        });

        break;
      }
    }
  }

  // Try to find this option in override rules
  let overrideRuleFound = false;

  for (const rule of fieldConfig.overrides) {
    for (const prop of rule.properties) {
      if (prop.id === fieldOption.id) {
        infoDots.push({
          type: 'rule',
          description: overrideRuleTooltipDescription,
          tooltip: function TooltipContent() {
            return <div>{overrideRuleTooltipDescription}</div>;
          },
        });

        overrideRuleFound = true;
        break;
      }
    }

    if (overrideRuleFound) {
      break;
    }
  }

  return infoDots;
}

const getStyles = (theme: GrafanaTheme2) => {
  const common: CSSObject = {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginLeft: theme.spacing(1),
    position: 'relative',
    top: '-1px',
  };

  return {
    wrapper: css({
      display: 'flex',
    }),
    rule: css({
      ...common,
      backgroundColor: theme.colors.primary.main,
    }),
    data: css({
      ...common,
      backgroundColor: theme.colors.warning.main,
    }),
  };
};
