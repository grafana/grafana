import { css, cx } from '@emotion/css';
import { subHours } from 'date-fns';
import { useState } from 'react';

import { GrafanaTheme2, RawTimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useSplitter, useStyles2, withErrorBoundary } from '@grafana/ui';

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

const initialSize = 1 / 3;

function Workbench({ window }: WorkbenchProps) {
  const styles = useStyles2(getStyles);
  const [flexSize, setFlexSize] = useState<number>(initialSize);

  // splitter for template and payload editor
  const splitter = useSplitter({
    direction: 'row',
    // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
    initialSize: initialSize,
    dragPosition: 'middle',
    onResizing: (flexSize) => {
      // by updating the flex size on resize, we can force all of the splitter props to be updated for all divs below
      // this is a pretty ugly hack but the best we can do for now
      setFlexSize(flexSize);
    },
  });

  return (
    <div style={{ position: 'relative', display: 'flex', flexGrow: 1, width: '100%', height: '100%' }}>
      {/* dummy splitter to handle flex width of group items */}
      <div {...splitter.containerProps}>
        <div {...splitter.primaryProps}>
          <div className={cx(styles.containerWithBorderAndRadius, styles.flexFull, styles.minColumnWidth)}>
            <EditorColumnHeader label={t('alerting.left-column.label-instances', 'Instances')} />
          </div>
        </div>
        <div {...splitter.splitterProps} />
        <div {...splitter.secondaryProps}>
          <div className={cx(styles.containerWithBorderAndRadius, styles.flexFull, styles.minColumnWidth)}>
            <EditorColumnHeader label={t('alerting.right-column.label-state', 'State')} />
          </div>
        </div>
      </div>

      {/* groups go here */}
      <div data-testid="groups-container" className={cx(splitter.containerProps.className, styles.groupsContainer)}>
        {/* group 1 */}
        <div className={styles.groupItemWrapper}>
          <div style={{ minWidth: 'min-content', flexGrow: flexSize }} className={cx(styles.leftColumn, styles.column)}>
            <div className={styles.columnContent}>
              <Trans i18nKey="alerting.workbench.left">left</Trans>
            </div>
          </div>
          <div
            style={{ minWidth: 'min-content', flexGrow: 1 - flexSize }}
            className={cx(styles.rightColumn, styles.column)}
          >
            <div className={styles.columnContent}>
              <Trans i18nKey="alerting.workbench.right">right</Trans>
            </div>
          </div>
        </div>
        {/* group 2 */}
        <div className={styles.groupItemWrapper}>
          <div style={{ minWidth: 'min-content', flexGrow: flexSize }} className={cx(styles.leftColumn, styles.column)}>
            <div className={styles.columnContent}>
              <Trans i18nKey="alerting.workbench.left">left</Trans>
            </div>
          </div>
          <div
            style={{ minWidth: 'min-content', flexGrow: 1 - flexSize }}
            className={cx(styles.rightColumn, styles.column)}
          >
            <div className={styles.columnContent}>
              <Trans i18nKey="alerting.workbench.right">right</Trans>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    groupsContainer: css({
      position: 'absolute',
      width: '100%',
      height: '100%',

      display: 'flex',
      flexDirection: 'column',
      paddingTop: theme.spacing(4),

      overflow: 'scroll',
    }),
    groupItemWrapper: css({
      display: 'flex',
      flexDirection: 'row',
      flex: 0,
      gap: theme.spacing(2),
    }),
    column: css({
      display: 'flex',
      position: 'relative',
      flexBasis: 0,
      border: 'solid 1px transparent',
      borderBottom: `1px solid ${theme.colors.border.medium}`,
    }),
    leftColumn: css({
      background: `rgba(0, 0, 255, 0.1)`,
    }),
    rightColumn: css({
      background: `rgba(255, 0, 0, 0.1)`,
    }),
    columnContent: css({
      padding: 5,
    }),
    flexFull: css({
      flex: 1,
    }),
    minColumnWidth: css({
      minWidth: 300,
    }),
    containerWithBorderAndRadius: css({
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.medium}`,
    }),
  };
};

export default withErrorBoundary(TriagePage);
