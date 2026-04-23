import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, Stack, useStyles2 } from '@grafana/ui';

import { useShowDependencyArrowsPref } from '../hooks/useShowDependencyArrowsPref';
import { detectDependencies } from '../lib/detectDependencies';
import { buildGroupIdentifier } from '../lib/groupIdentifier';
import { type TreeDataSource, type TreeFolder } from '../lib/types';

import { EmptyFolderState } from './EmptyFolderState';
import { EvaluationChainCard } from './EvaluationChainCard';
import { RuleCard } from './RuleCard';

interface Props {
  dataSource: TreeDataSource;
  folder: TreeFolder;
}

export function FolderDetail({ dataSource, folder }: Props) {
  const styles = useStyles2(getStyles);
  const [showArrows, setShowArrows] = useShowDependencyArrowsPref();

  return (
    <div className={styles.wrapper}>
      <div className={styles.breadcrumb}>
        <Icon name="database" className={styles.dsIcon} />
        <span>{dataSource.name}</span>
        <span>›</span>
      </div>
      <div className={styles.headerRow}>
        <h2 className={styles.folderTitle}>
          <Icon name="folder-open" />
          <span>{folder.title}</span>
        </h2>
        <Checkbox
          label={t('alerting.rule-list-v2.show-dependency-arrows', 'Show dependency arrows')}
          value={showArrows}
          onChange={(e) => setShowArrows(e.currentTarget.checked)}
        />
      </div>
      {folder.groups.length === 0 ? (
        <EmptyFolderState />
      ) : (
        <Stack direction="column" gap={1}>
          {folder.groups.map((group) => {
            const chain = detectDependencies(group);
            const groupIdentifier = buildGroupIdentifier(dataSource, folder, group);
            if (chain.isChain) {
              return (
                <EvaluationChainCard
                  key={group.name}
                  group={group}
                  chain={chain}
                  groupIdentifier={groupIdentifier}
                  showArrows={showArrows}
                />
              );
            }
            return group.rules.map((rule) => (
              <RuleCard
                key={`${group.name}-${rule.name}`}
                rule={rule}
                instanceCount={instanceCount(rule)}
                groupIdentifier={groupIdentifier}
              />
            ));
          })}
        </Stack>
      )}
    </div>
  );
}

function instanceCount(rule: { type: string; alerts?: unknown[] }): number | undefined {
  if (rule.type !== 'alerting') {
    return undefined;
  }
  return rule.alerts?.length ?? 0;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      flex: 1,
      minWidth: 0,
      padding: theme.spacing(1, 2),
    }),
    breadcrumb: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    dsIcon: css({
      color: theme.colors.text.secondary,
    }),
    headerRow: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
    }),
    folderTitle: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      margin: 0,
      fontSize: theme.typography.h3.fontSize,
    }),
  };
}
