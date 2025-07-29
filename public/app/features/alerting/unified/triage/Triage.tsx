import { css, cx } from '@emotion/css';
import { subHours } from 'date-fns';

import { GrafanaTheme2, RawTimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, useSplitter, useStyles2, withErrorBoundary } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { EditorColumnHeader } from '../components/contact-points/templates/EditorColumnHeader';

export const TriagePage = () => {
  const window: RawTimeRange = {
    from: subHours(new Date(), 1).toISOString(),
    to: new Date().toISOString(),
  };

  return (
    <AlertingPageWrapper
      navId="alerting"
      title={t('alerting.pages.triage.title', 'Triage')}
      subTitle="Learn about problems in your systems moments after they occur"
      pageNav={{
        text: t('alerting.pages.triage.title', 'Triage'),
      }}
    >
      <Workbench window={window} />
    </AlertingPageWrapper>
  );
};

type WorkbenchProps = {
  window: RawTimeRange;
  groupBy?: string[]; // @TODO proper type
};

function Workbench({ window }: WorkbenchProps) {
  const styles = useStyles2(getStyles);

  // splitter for template and payload editor
  const splitter = useSplitter({
    direction: 'row',
    // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
    initialSize: 1 / 4,
    dragPosition: 'middle',
  });

  return (
    <div style={{ display: 'flex', flexGrow: 1, width: '100%', height: '100%' }}>
      {/* t */}
      <div {...splitter.containerProps}>
        {/*  */}
        <div {...splitter.primaryProps}>
          <div
            className={cx(
              styles.containerWithBorderAndRadius,
              styles.minColumnSize,
              styles.flexFull,
              styles.leftColumn
            )}
          >
            <LeftColumn />
          </div>
        </div>
        <div {...splitter.splitterProps} />
        <div {...splitter.secondaryProps}>
          <div
            className={cx(
              styles.containerWithBorderAndRadius,
              styles.minColumnSize,
              styles.flexFull,
              styles.rightColumn
            )}
          >
            <RightColumn />
          </div>
        </div>
      </div>
    </div>
  );
}

function LeftColumn() {
  return (
    <Box flex={1}>
      <EditorColumnHeader label={t('alerting.left-column.label-instances', 'Instances')} />
    </Box>
  );
}

function RightColumn() {
  return (
    <Box flex={1}>
      <EditorColumnHeader label={t('alerting.right-column.label-state', 'State')} />
    </Box>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    leftColumn: css({
      background: `rgba(0, 0, 255, 0.1)`,
    }),
    rightColumn: css({
      background: `rgba(255, 0, 0, 0.1)`,
    }),
    flexFull: css({
      flex: 1,
    }),
    minColumnSize: css({
      minHeight: 800,
      minWidth: 300,
    }),
    containerWithBorderAndRadius: css({
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.medium}`,
    }),
  };
};

export default withErrorBoundary(TriagePage);
