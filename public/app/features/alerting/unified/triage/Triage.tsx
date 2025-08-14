import { css, cx } from '@emotion/css';
import { scaleUtc } from 'd3-scale';
import { subDays, subHours } from 'date-fns';
import { times } from 'lodash';
import { ReactNode, useMemo } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, Stack, Text, TextLink, useSplitter, useStyles2, withErrorBoundary } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { EditorColumnHeader } from '../components/contact-points/templates/EditorColumnHeader';

type Domain = [Date, Date];

export const TriagePage = () => {
  const domain = [subHours(new Date(), 1), new Date()];

  return (
    <AlertingPageWrapper
      navId="alerting"
      title={t('alerting.pages.triage.title', 'Triage')}
      subTitle="Learn about problems in your systems moments after they occur"
      pageNav={{
        text: t('alerting.pages.triage.title', 'Triage'),
      }}
    >
      <Workbench domain={domain} />
    </AlertingPageWrapper>
  );
};

type WorkbenchProps = {
  domain: Domain;
  groupBy?: string[]; // @TODO proper type
};

const initialSize = 1 / 3;

function Workbench({ domain }: WorkbenchProps) {
  const styles = useStyles2(getStyles);

  // splitter for template and payload editor
  const splitter = useSplitter({
    direction: 'row',
    // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
    initialSize: initialSize,
    dragPosition: 'middle',
  });

  // this will measure the size of the left most column of the splitter, so we can use it to set the width of the group items
  const [ref, rect] = useMeasure<HTMLDivElement>();
  const leftColumnWidth = rect.width + 2; // +2 for the border

  return (
    <div style={{ position: 'relative', display: 'flex', flexGrow: 1, width: '100%', height: '100%' }}>
      {/* dummy splitter to handle flex width of group items */}
      <div {...splitter.containerProps}>
        <div {...splitter.primaryProps}>
          <div ref={ref} className={cx(styles.containerWithBorderAndRadius, styles.flexFull, styles.minColumnWidth)} />
        </div>
        <div {...splitter.splitterProps} />
        <div {...splitter.secondaryProps}>
          <div className={cx(styles.containerWithBorderAndRadius, styles.flexFull, styles.minColumnWidth)} />
        </div>
      </div>

      {/* content goes here */}
      <div data-testid="groups-container" className={cx(splitter.containerProps.className, styles.groupsContainer)}>
        <div className={cx(styles.groupItemWrapper(leftColumnWidth), styles.stickyHeader)}>
          <EditorColumnHeader label={t('alerting.left-column.label-instances', 'Instances')} />
          <EditorColumnHeader>
            <TimelineHeader domain={domain} />
          </EditorColumnHeader>
        </div>
        {/* Render a lot of group items to test the layout */}
        {times(50, () => (
          <GroupWrapper width={leftColumnWidth} />
        ))}
      </div>
    </div>
  );
}

interface GroupWrapperProps {
  width: number;
}

const GroupWrapper = ({ width }: GroupWrapperProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.groupItemWrapper(width)}>
      <div className={cx(styles.leftColumn, styles.column)}>
        <div className={styles.columnContent}>
          <GroupedItem label={t('alerting.group-wrapper.label-my-service', 'My Service')} />
        </div>
      </div>
      <div style={{ minWidth: 'min-content', flexGrow: 1 }} className={cx(styles.rightColumn, styles.column)}>
        <div className={styles.columnContent}>
          <Trans i18nKey="alerting.workbench.right">right</Trans>
        </div>
      </div>
    </div>
  );
};

interface GroupedItemProps {
  label: ReactNode;
}

const GroupedItem = ({ label }: GroupedItemProps) => {
  return (
    <TextLink inline={false} href="#">
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="angle-down" /> {label}
      </Stack>
    </TextLink>
  );
};

interface TimelineProps {
  domain: Domain;
}

const TimelineHeader = ({ domain }: TimelineProps) => {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  console.log(width);

  const ticks = useMemo(() => {
    const xScale = scaleUtc().domain(domain).range([0, width]).nice(0);
    const tickFormatter = xScale.tickFormat();

    return xScale.ticks(5).map((value) => ({
      value: tickFormatter(value),
      xOffset: xScale(value),
    }));
  }, [domain, width]);

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <Stack flex={1} direction="row" justifyContent="space-between">
        {ticks.map((tick) => (
          <Text variant="bodySmall" color="secondary">
            {tick.value}
          </Text>
        ))}
      </Stack>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    stickyHeader: css({
      position: 'sticky',
      top: 0,
      zIndex: 1,
    }),
    groupsContainer: css({
      position: 'absolute',
      width: '100%',
      height: '100%',

      display: 'flex',
      flexDirection: 'column',

      overflow: 'scroll',
    }),
    groupItemWrapper: (width: number) =>
      css({
        display: 'grid',
        gridTemplateColumns: `${width}px auto`,
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
      width: '100%',
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
