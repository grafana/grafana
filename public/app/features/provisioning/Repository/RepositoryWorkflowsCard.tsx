import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Badge, Card, Icon, type IconName, Stack, Text, useStyles2 } from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { getRemoteConfig } from '../utils/git';
import { getIsReadOnlyWorkflows } from '../utils/repository';

interface WorkflowTileProps {
  icon: IconName;
  title: string;
  description: string;
  enabled: boolean;
}

function WorkflowTile({ icon, title, description, enabled }: WorkflowTileProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={enabled ? styles.tileEnabled : styles.tileDisabled}>
      <div className={styles.tileIcon}>
        <Icon name={icon} />
      </div>
      <div className={styles.tileText}>
        <Text weight="medium">{title}</Text>
        <Text color="secondary" variant="bodySmall">
          {description}
        </Text>
      </div>
      <Badge
        color={enabled ? 'green' : 'darkgrey'}
        text={
          enabled
            ? t('provisioning.repository-workflows.enabled', 'Enabled')
            : t('provisioning.repository-workflows.not-enabled', 'Not enabled')
        }
      />
    </div>
  );
}

export function RepositoryWorkflowsCard({ repo }: { repo: Repository }) {
  const styles = useStyles2(getStyles);
  const workflows = repo.spec?.workflows;
  const branch = getRemoteConfig(repo.spec)?.branch ?? '';

  return (
    <Card noMargin>
      <Card.Heading>
        <Trans i18nKey="provisioning.repository-workflows.title">Edit workflows</Trans>
      </Card.Heading>
      <Card.Description>
        <Stack direction="column" gap={2}>
          {getIsReadOnlyWorkflows(workflows) && (
            <Alert severity="info" title={t('provisioning.repository-workflows.read-only-title', 'Read-only')}>
              <Trans i18nKey="provisioning.repository-workflows.read-only">
                People can view these resources in Grafana but can&apos;t save changes here. Make changes in Git, then
                pull them in.
              </Trans>
            </Alert>
          )}
          <div className={styles.tiles}>
            <WorkflowTile
              icon="pen"
              enabled={Boolean(workflows?.includes('write'))}
              title={t('provisioning.repository-workflows.write-title', 'Push to the configured branch')}
              description={t(
                'provisioning.repository-workflows.write-description',
                'Changes are pushed directly to {{branch}}.',
                { branch }
              )}
            />
            <WorkflowTile
              icon="code-branch"
              enabled={Boolean(workflows?.includes('branch'))}
              title={t('provisioning.repository-workflows.branch-title', 'Save as a pull request')}
              description={t(
                'provisioning.repository-workflows.branch-description',
                'Changes go to a new branch and are proposed as a pull request to {{branch}}.',
                { branch }
              )}
            />
          </div>
        </Stack>
      </Card.Description>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const tile = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
  } as const;

  return {
    tiles: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
      gap: theme.spacing(2),
    }),
    tileEnabled: css({ ...tile, border: `1px solid ${theme.colors.primary.border}` }),
    tileDisabled: css({ ...tile, border: `1px dashed ${theme.colors.border.medium}`, opacity: 0.6 }),
    tileText: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(0.5), flex: 1, minWidth: 0 }),
    tileIcon: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(4),
      height: theme.spacing(4),
      flexShrink: 0,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.action.hover,
    }),
  };
};
