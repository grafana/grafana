import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, useStyles2 } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';

interface Props {
  dashboard: DashboardScene;
}

export function RulesJsonViewer({ dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const { dashboardRules } = dashboard.useState();

  const rulesState = dashboardRules?.useState();
  const rules = rulesState?.rules ?? [];

  const rulesJson = JSON.stringify(
    rules.map((r) => r.serialize()),
    null,
    2
  );

  return (
    <div className={styles.container}>
      <CodeEditor
        width="100%"
        value={rulesJson}
        language="json"
        showLineNumbers={true}
        showMiniMap={false}
        readOnly={true}
        containerStyles={styles.editor}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
    }),
    editor: css({
      flexGrow: 1,
    }),
  };
}
