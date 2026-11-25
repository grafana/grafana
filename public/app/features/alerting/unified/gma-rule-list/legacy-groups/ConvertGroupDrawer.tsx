import { css } from '@emotion/css';
import { useBeforeUnload } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  LoadingPlaceholder,
  ScrollContainer,
  Stack,
  Text,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { Prompt } from 'app/core/components/FormPrompt/Prompt';
import { useAppNotification } from 'app/core/copy/appNotification';
import { type GrafanaPromRuleDTO, type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { makeFolderAlertsLink, stringifyErrorLike } from '../../utils/misc';
import { formatPrometheusDuration } from '../../utils/time';
import { RuleRowList } from '../rule-row/RuleRowList';

import { LegacyGroupRuleRow } from './LegacyGroupRuleRow';
import { type StayReason, useConvertGroup } from './convertGroup';
import { useConversionPlan } from './useConversionPlan';

interface ConvertGroupDrawerProps {
  group: GrafanaPromRuleGroupDTO;
  /** Titles from the outermost folder down to the group's folder. */
  folderPath: string[];
  /** The subfolder an earlier run on this page created, which the folder search may not list yet. */
  createdFolderUid?: string;
  onFolderCreated: (uid: string) => void;
  /** `groupChanged`: some rules left the group, so the list must reload. */
  onClose: (groupChanged: boolean) => void;
}

export function ConvertGroupDrawer({
  group,
  folderPath,
  createdFolderUid,
  onFolderCreated,
  onClose,
}: ConvertGroupDrawerProps) {
  const notifyApp = useAppNotification();
  const title = group.name.trim();
  const targetPath = [...folderPath, title].join(' / ');
  const interval = formatPrometheusDuration(group.interval * 1000);

  const { plan, targetUid, reservedTitle, checking, checkError } = useConversionPlan(group, title, createdFolderUid);
  const ready = !checking && !checkError;

  const { progress, convert } = useConvertGroup({
    group,
    rules: plan.moves,
    folderUid: targetUid,
    onFolderCreated,
    onDone: (result, folderUid) => {
      notifyApp.success(
        t('alerting.gma-rule-list.legacy-groups.converted', '', {
          count: result.movedUids.length,
          path: targetPath,
          interpolation: { escapeValue: false },
          defaultValue_one: 'Moved {{count}} rule to {{path}}',
          defaultValue_other: 'Moved {{count}} rules to {{path}}',
        }),
        '',
        <TextLink href={makeFolderAlertsLink(folderUid, title)}>
          <Trans i18nKey="alerting.gma-rule-list.legacy-groups.open-folder">Open folder</Trans>
        </TextLink>
      );
      onClose(true);
    },
  });
  const running = progress.state === 'running';
  const leaveWarning = t('alerting.gma-rule-list.legacy-groups.leave-warning', 'Rules are still being moved.');
  useBeforeUnload(running, leaveWarning);

  // Reported only on close: reloading the list while open would replace the group and restart its checks.
  const close = () => onClose(progress.movedUids.length + progress.changedUids.length > 0);

  return (
    <Drawer
      size="md"
      title={t('alerting.gma-rule-list.legacy-groups.modal-title', 'Convert {{group}} to a subfolder', {
        group: group.name,
        interpolation: { escapeValue: false },
      })}
      onClose={running ? () => {} : close}
      closeOnMaskClick={!running}
      scrollableContent={false}
    >
      <Prompt when={running} message={leaveWarning} />
      <Stack direction="column" height="100%">
        {checking && (
          <LoadingPlaceholder text={t('alerting.gma-rule-list.legacy-groups.checking', 'Checking the rules...')} />
        )}
        {!checking && Boolean(checkError) && (
          <Alert
            severity="error"
            title={t('alerting.gma-rule-list.legacy-groups.check-error', 'Could not check the rules')}
          >
            {stringifyErrorLike(checkError)}
          </Alert>
        )}
        {ready && (
          <Box shrink={0} paddingBottom={2}>
            <Stack direction="column" gap={2}>
              {reservedTitle ? (
                <Alert
                  severity="warning"
                  title={t('alerting.gma-rule-list.legacy-groups.reserved', 'This group can’t become a folder')}
                >
                  <Trans i18nKey="alerting.gma-rule-list.legacy-groups.reserved-body">
                    “General” is reserved for the root folder.
                  </Trans>
                </Alert>
              ) : (
                <TargetText nothingMoves={plan.moves.length === 0} exists={Boolean(targetUid)} path={targetPath} />
              )}
              <Text color="secondary">
                <Trans i18nKey="alerting.gma-rule-list.legacy-groups.interval" values={{ interval }}>
                  Each rule keeps the group’s evaluation interval of {'{{interval}}'}.
                </Trans>
              </Text>
              <Alert
                severity="warning"
                title={t('alerting.gma-rule-list.legacy-groups.no-undo', 'This can’t be undone')}
              >
                <Trans i18nKey="alerting.gma-rule-list.legacy-groups.consequences">
                  Rule UIDs and links stay the same. Alerts from moved rules carry the new folder in their
                  grafana_folder label, so notification policies, silences and grouping that match the old folder stop
                  matching them, and firing alerts may resolve and fire again.
                </Trans>
              </Alert>
              {progress.state === 'failed' && (
                <Alert
                  severity="error"
                  title={t('alerting.gma-rule-list.legacy-groups.partial', '{{moved}} of {{total}} rules moved', {
                    moved: progress.movedUids.length,
                    total: plan.moves.length,
                  })}
                >
                  {stringifyErrorLike(progress.error)}
                </Alert>
              )}
              {progress.changedUids.length > 0 && (
                <Text color="secondary">
                  {t('alerting.gma-rule-list.legacy-groups.changed-elsewhere', '', {
                    count: progress.changedUids.length,
                    defaultValue_one: '{{count}} rule was changed elsewhere and left as it is.',
                    defaultValue_other: '{{count}} rules were changed elsewhere and left as they are.',
                  })}
                </Text>
              )}
            </Stack>
          </Box>
        )}
        {/* Reversed: the buttons come before the rule links for keyboard users but are drawn below them. */}
        <Stack direction="column-reverse" grow={1} minHeight={0}>
          <Box shrink={0}>
            <Divider spacing={2} />
            <Stack justifyContent="flex-end" alignItems="center" gap={1}>
              {running && (
                <Text>
                  <Trans
                    i18nKey="alerting.gma-rule-list.legacy-groups.progress"
                    values={{ moved: progress.movedUids.length, total: plan.moves.length }}
                  >
                    Moving rules: {'{{moved}}'} of {'{{total}}'} done
                  </Trans>
                </Text>
              )}
              <Button variant="secondary" fill="outline" onClick={close} disabled={running}>
                <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
              </Button>
              <Button
                onClick={() => void convert()}
                disabled={checking || Boolean(checkError) || reservedTitle || plan.moves.length === 0 || running}
                icon={running ? 'spinner' : undefined}
              >
                {progress.state === 'failed' ? (
                  <Trans i18nKey="alerting.gma-rule-list.legacy-groups.retry">Retry</Trans>
                ) : (
                  <Trans i18nKey="alerting.gma-rule-list.legacy-groups.convert">Convert</Trans>
                )}
              </Button>
            </Stack>
          </Box>
          <Box grow={1} minHeight={0}>
            {ready && (
              <ScrollContainer>
                <Stack direction="column" gap={2}>
                  <RuleSection
                    title={t('alerting.gma-rule-list.legacy-groups.moves', 'Moves ({{moveCount}})', {
                      moveCount: plan.moves.length,
                    })}
                    rules={plan.moves.map((rule) => ({ rule }))}
                    interval={interval}
                  />
                  {plan.stays.length > 0 && (
                    <RuleSection
                      title={t('alerting.gma-rule-list.legacy-groups.stays', 'Stays in the group ({{stayCount}})', {
                        stayCount: plan.stays.length,
                      })}
                      rules={plan.stays.map(({ rule, reason }) => ({ rule, note: stayReasonText(reason) }))}
                      interval={interval}
                    />
                  )}
                </Stack>
              </ScrollContainer>
            )}
          </Box>
        </Stack>
      </Stack>
    </Drawer>
  );
}

function TargetText({ nothingMoves, exists, path }: { nothingMoves: boolean; exists: boolean; path: string }) {
  if (nothingMoves) {
    return (
      <Alert
        severity="info"
        title={t('alerting.gma-rule-list.legacy-groups.nothing-moves', 'None of these rules can move')}
      >
        <Trans i18nKey="alerting.gma-rule-list.legacy-groups.nothing-moves-body">
          Each rule below says why it stays in the group.
        </Trans>
      </Alert>
    );
  }
  if (exists) {
    return (
      <Alert
        severity="warning"
        title={t('alerting.gma-rule-list.legacy-groups.existing-folder-title', '{{path}} already exists', {
          path,
          interpolation: { escapeValue: false },
        })}
      >
        <Trans i18nKey="alerting.gma-rule-list.legacy-groups.existing-folder">
          The rules join whatever is already in that folder.
        </Trans>
      </Alert>
    );
  }
  return (
    <Text>
      <Trans i18nKey="alerting.gma-rule-list.legacy-groups.new-folder" values={{ path }}>
        Rules move into a new folder, <Text weight="bold">{'{{path}}'}</Text>.
      </Trans>
    </Text>
  );
}

interface RuleSectionProps {
  title: string;
  rules: Array<{ rule: GrafanaPromRuleDTO; note?: string }>;
  interval: string;
}

function RuleSection({ title, rules, interval }: RuleSectionProps) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={0.5}>
      <div className={styles.sectionTitle}>
        <Text weight="medium">{title}</Text>
      </div>
      <RuleRowList aria-label={title}>
        {rules.map(({ rule, note }) => (
          <LegacyGroupRuleRow key={rule.uid} rule={rule} interval={interval} note={note} />
        ))}
      </RuleRowList>
    </Stack>
  );
}

// Provisioned and plugin rules need no note: the row shows their origin badge.
function stayReasonText(reason: StayReason): string | undefined {
  switch (reason) {
    case 'provisioned':
    case 'plugin':
      return undefined;
    case 'sequence':
      return t('alerting.gma-rule-list.legacy-groups.reason-sequence', 'In a rule sequence');
    case 'sequence-unknown':
      return t('alerting.gma-rule-list.legacy-groups.reason-sequence-unknown', 'Couldn’t check rule sequences');
    case 'permission':
      return t('alerting.gma-rule-list.legacy-groups.reason-permission', 'No permission to move');
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Sticky per section, so each heading takes over from the one above.
  sectionTitle: css({
    position: 'sticky',
    top: 0,
    zIndex: 1,
    paddingBottom: theme.spacing(0.5),
    background: theme.components.drawer?.background ?? theme.colors.background.primary,
  }),
});
