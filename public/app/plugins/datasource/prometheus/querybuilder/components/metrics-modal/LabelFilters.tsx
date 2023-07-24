import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { useTheme2 } from '@grafana/ui/src';

import { QueryBuilderLabelFilter } from '../../shared/types';
import { PromVisualQuery } from '../../types';

import { LabelNameValue } from './LabelNameValue';
import { LabelNameLabel } from './MetricsModal';
import { PromCollapsableSection } from './PromCollapsableSection';
import { MetricsModalState } from './state/state';

interface Props {
  state: MetricsModalState;
  query: PromVisualQuery;
  fetchValuesForLabelName: (labelName: string) => void;
  setLabelValueSelected: (labelName: string, labelValue: string, selected: boolean) => void;
}

export const LabelFilters = ({ state, query, fetchValuesForLabelName, setLabelValueSelected }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  {
    /* @TODO this needs to be a virtualized list */
  }
  return (
    <>
      {state.labelNames
        .filter((label) => label !== '__name__')
        .map((labelName, index) => (
          <PromCollapsableSection
            className={styles.labelNamesCollapsableSection}
            key={'label_names_' + labelName}
            label={<LabelNameLabel labelName={labelName} />}
            onToggle={(isOpen: boolean) => {
              if (isOpen) {
                fetchValuesForLabelName(labelName);
              }
            }}
            isOpen={query.labels.some((label) => label.label === labelName) ?? false}
          >
            {state.labelValues[labelName]?.map((labelValue) => (
              <LabelNameValue
                key={'label_values_' + labelValue}
                onChange={(e) => {
                  setLabelValueSelected(labelName, labelValue, e.currentTarget.checked);
                }}
                labelName={labelName}
                labelValue={labelValue}
                checked={
                  state.query.labels.some((label: QueryBuilderLabelFilter) =>
                    isLabelValueSelected(label, labelValue, labelName)
                  ) ?? false
                }
              />
            ))}
          </PromCollapsableSection>
        ))}
    </>
  );
};

/**
 * Checks if the label value is currently selected
 * @param label
 * @param labelValue
 * @param labelName
 */
const isLabelValueSelected = (label: QueryBuilderLabelFilter, labelValue: string, labelName: string) => {
  if (label.op === '=') {
    return label.value === labelValue && labelName === label.label;
  }
  if (label.op === '=~') {
    return label.value.split('|').some((value) => value === labelValue && labelName === label.label);
  }
  // @todo need to impelemnt for all operators
  console.warn('Non-implemented label operator', label.op);
  return label.value === labelValue && label.label === labelName;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    labelsTitle: css`
      font-weight: ${theme.typography.fontWeightBold};
      font-size: ${theme.typography.fontSize}px;
      padding: 5px 8px 5px 32px;
      border-bottom: 1px solid ${theme.colors.border.weak};
    `,

    labelNamesCollapsableSection: css`
      padding: 0;
    `,
  };
};
