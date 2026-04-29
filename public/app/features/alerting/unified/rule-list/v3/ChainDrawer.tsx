import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Drawer, Icon, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';

import { type Chain, type ChainStep as ChainStepType, useGetChainQuery } from '../../api/chainsApi';

interface ChainDrawerProps {
  chainId: string;
  currentPosition: number;
  onClose: () => void;
}

export function ChainDrawer({ chainId, currentPosition, onClose }: ChainDrawerProps) {
  const { data: chain, isLoading, error } = useGetChainQuery({ chainId });

  const title = (
    <Stack direction="row" alignItems="center" gap={1}>
      <Icon name="link" />
      <Text element="h3" variant="h4">
        <Trans i18nKey="alerting.rule-list-v3.drawer.title">Evaluation chain</Trans>
      </Text>
    </Stack>
  );

  return (
    <Drawer size="sm" onClose={onClose} title={title}>
      {isLoading && <LoadingPlaceholder text={t('alerting.rule-list-v3.drawer.loading', 'Loading chain details...')} />}
      {Boolean(error) && (
        <Alert severity="error" title={t('alerting.rule-list-v3.drawer.error', 'Failed to load chain')} />
      )}
      {chain && <ChainDrawerContent chain={chain} currentPosition={currentPosition} />}
    </Drawer>
  );
}

function ChainDrawerContent({ chain, currentPosition }: { chain: Chain; currentPosition: number }) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={3}>
      <div className={styles.meta}>
        <div>
          <div className={styles.eyebrow}>
            <Trans i18nKey="alerting.rule-list-v3.drawer.mode">Mode</Trans>
          </div>
          <Text variant="body">{chain.mode}</Text>
        </div>
        <div>
          <div className={styles.eyebrow}>
            <Trans i18nKey="alerting.rule-list-v3.drawer.interval">Interval</Trans>
          </div>
          <Text variant="body">{chain.interval || '—'}</Text>
        </div>
        <div>
          <div className={styles.eyebrow}>
            <Trans i18nKey="alerting.rule-list-v3.drawer.rules-count">Rules</Trans>
          </div>
          <Text variant="body">{chain.steps.length}</Text>
        </div>
      </div>

      <div>
        <div className={styles.eyebrow}>
          <Trans i18nKey="alerting.rule-list-v3.drawer.evaluation-order">Evaluation order</Trans>
        </div>
        <ol className={styles.steps}>
          {chain.steps.map((step, index) => (
            <ChainStep
              key={`${step.name}-${index}`}
              step={step}
              position={index + 1}
              isCurrent={index + 1 === currentPosition}
            />
          ))}
        </ol>
      </div>
    </Stack>
  );
}

interface ChainStepProps {
  step: ChainStepType;
  position: number;
  isCurrent: boolean;
}

function ChainStep({ step, position, isCurrent }: ChainStepProps) {
  const styles = useStyles2(getStyles);
  const isRecording = step.type === 'recording';

  const typeLabel = isRecording ? (
    <Trans i18nKey="alerting.rule-list-v3.drawer.recording-rule">Recording rule</Trans>
  ) : (
    <Trans i18nKey="alerting.rule-list-v3.drawer.alert-rule">Alert rule</Trans>
  );

  return (
    <li className={cx(styles.step, isCurrent && styles.stepCurrent)}>
      <span className={cx(styles.stepNum, isCurrent && styles.stepNumCurrent)} aria-hidden>
        {position}
      </span>
      <div className={cx(styles.stepType, isRecording ? styles.typeRecording : styles.typeAlert)}>
        <Icon size="xs" name={isRecording ? 'record-audio' : 'bell'} />
        <span>{typeLabel}</span>
      </div>
      <div className={cx(styles.stepName, isRecording && styles.stepNameMono)}>{step.name}</div>
      {step.sub && <div className={styles.stepSub}>{step.sub}</div>}
      {isCurrent && (
        <span className={styles.youAreHere}>
          <Trans i18nKey="alerting.rule-list-v3.drawer.you-are-here">You are here</Trans>
        </span>
      )}
    </li>
  );
}

function getStyles(theme: GrafanaTheme2) {
  const primary = theme.colors.primary;
  const connectorColor = primary.border;

  return {
    meta: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(3),
      paddingBottom: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    eyebrow: css({
      fontSize: theme.typography.bodySmall.fontSize,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(0.5),
    }),
    steps: css({
      listStyle: 'none',
      padding: 0,
      margin: 0,
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        left: '19px',
        top: '14px',
        bottom: '14px',
        width: '2px',
        background: connectorColor,
      },
    }),
    step: css({
      position: 'relative',
      padding: theme.spacing(1.25, 1.25, 1.25, 6.5),
      marginBottom: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
    }),
    stepCurrent: css({
      background: primary.transparent,
    }),
    stepNum: css({
      position: 'absolute',
      left: theme.spacing(1),
      top: '50%',
      transform: 'translateY(-50%)',
      width: '24px',
      height: '24px',
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.background.canvas,
      border: `2px solid ${primary.border}`,
      color: primary.text,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightBold,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    }),
    stepNumCurrent: css({
      background: primary.main,
      color: primary.contrastText,
      borderColor: primary.main,
    }),
    stepType: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      fontSize: theme.typography.bodySmall.fontSize,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: theme.spacing(0.25),
    }),
    typeRecording: css({
      color: theme.colors.warning.text,
    }),
    typeAlert: css({
      color: theme.colors.info.text,
    }),
    stepName: css({
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: 1.35,
    }),
    stepNameMono: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    stepSub: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing(0.5),
    }),
    youAreHere: css({
      position: 'absolute',
      top: theme.spacing(1.25),
      right: theme.spacing(1.25),
      fontSize: theme.typography.bodySmall.fontSize,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: primary.text,
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
  };
}
