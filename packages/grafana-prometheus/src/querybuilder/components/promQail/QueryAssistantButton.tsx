import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, Tooltip, useTheme2 } from '@grafana/ui';

import { getStyles } from './PromQail';
import AI_Logo_color from './resources/AI_Logo_color.svg';

export type Props = {
  llmAppEnabled: boolean;
  metric: string;
  setShowDrawer: (show: boolean) => void;
};

export function QueryAssistantButton(props: Props) {
  const { llmAppEnabled, metric, setShowDrawer } = props;

  const llmAppDisabled = !llmAppEnabled;
  const noMetricSelected = !metric;

  const theme = useTheme2();
  const styles = getStyles(theme);

  const button = () => {
    return (
      <Button
        variant={'secondary'}
        onClick={() => {
          reportInteraction('grafana_prometheus_promqail_ai_button_clicked', {
            metric: metric,
          });
          setShowDrawer(true);
        }}
        disabled={!metric || !llmAppEnabled}
        data-testid={selectors.components.DataSource.Prometheus.queryEditor.builder.queryAdvisor}
      >
        <img height={16} src={AI_Logo_color} alt="AI logo black and white" />
        {'\u00A0'}Get query suggestions
      </Button>
    );
  };

  const selectMetricMessage = (
    <Tooltip content={'First, select a metric.'} placement={'bottom-end'}>
      {button()}
    </Tooltip>
  );

  const llmAppMessage = (
    <Tooltip
      interactive={true}
      placement={'auto-end'}
      content={
        <div className={styles.enableButtonTooltip}>
          <h6>Query Advisor is disabled</h6>
          <div className={styles.enableButtonTooltipText}>To enable Query Advisor you must:</div>
          <div className={styles.enableButtonTooltipText}>
            <ul>
              <li>
                <a
                  href={'https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin/'}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.link}
                >
                  Install and enable the LLM plugin
                </a>
              </li>
              <li>Select a metric</li>
            </ul>
          </div>
        </div>
      }
    >
      {button()}
    </Tooltip>
  );

  if (llmAppDisabled) {
    return llmAppMessage;
  } else if (noMetricSelected) {
    return selectMetricMessage;
  } else {
    return button();
  }
}
