import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { Tag, IconButton } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { RuleModal } from './RuleModal';
import { Rule, Output, RuleType } from './types';

function renderOutputTags(key: string, output?: Output): React.ReactNode {
  if (!output?.type) {
    return null;
  }
  return <Tag key={key} name={output.type} />;
}

interface Props {
  rules: Rule[];
  onRuleChanged: () => void;
  selectRule?: Rule;
}

export const PipelineTable = (props: Props) => {
  const { rules } = props;
  const [isOpen, setOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule>();
  const [clickColumn, setClickColumn] = useState<RuleType>('converter');

  const onRowClick = (rule: Rule, event?: any) => {
    if (!rule) {
      return;
    }
    let column = event?.target?.getAttribute('data-column');
    if (!column || column === 'pattern') {
      column = 'converter';
    }
    setClickColumn(column);
    setSelectedRule(rule);
    setOpen(true);
  };

  // Supports selecting a rule from external config (after add rule)
  useEffect(() => {
    if (props.selectRule) {
      onRowClick(props.selectRule);
    }
  }, [props.selectRule]);

  const onRemoveRule = (pattern: string) => {
    getBackendSrv()
      .delete(`api/live/channel-rules`, JSON.stringify({ pattern: pattern }))
      .catch((e) => console.error(e))
      .finally(() => {
        props.onRuleChanged();
      });
  };

  const renderPattern = (pattern: string) => {
    if (pattern.startsWith('ds/')) {
      const idx = pattern.indexOf('/', 4);
      if (idx > 3) {
        const uid = pattern.substring(3, idx);
        const ds = getDatasourceSrv().getInstanceSettings(uid);
        if (ds) {
          return (
            <div>
              <Tag name={ds.name} colorIndex={1} /> &nbsp;
              <span>{pattern.substring(idx + 1)}</span>
            </div>
          );
        }
      }
    }
    return pattern;
  };

  return (
    <div>
      <div className="admin-list-table">
        <table className="filter-table filter-table--hover form-inline">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Converter</th>
              <th>Processor</th>
              <th>Output</th>
              <th style={{ width: 10 }}>&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.pattern} onClick={(e) => onRowClick(rule, e)} className={styles.row}>
                <td data-pattern={rule.pattern} data-column="pattern">
                  {renderPattern(rule.pattern)}
                </td>
                <td data-pattern={rule.pattern} data-column="converter">
                  {rule.settings?.converter?.type}
                </td>
                <td data-pattern={rule.pattern} data-column="processor">
                  {rule.settings?.frameProcessors?.map((processor) => (
                    <span key={rule.pattern + processor.type}>{processor.type}</span>
                  ))}
                </td>
                <td data-pattern={rule.pattern} data-column="output">
                  {rule.settings?.frameOutputs?.map((output) => (
                    <span key={rule.pattern + output.type}>{renderOutputTags('out', output)}</span>
                  ))}
                </td>
                <td>
                  <IconButton
                    name="trash-alt"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRule(rule.pattern);
                    }}
                  ></IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isOpen && selectedRule && (
        <RuleModal
          rule={selectedRule}
          isOpen={isOpen}
          onClose={() => {
            setOpen(false);
          }}
          clickColumn={clickColumn}
        />
      )}
    </div>
  );
};

const styles = {
  row: css`
    cursor: pointer;
  `,
};
