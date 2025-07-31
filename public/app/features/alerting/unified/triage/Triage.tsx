import { css, cx } from '@emotion/css';
import { scaleUtc } from 'd3-scale';
import { subDays } from 'date-fns';
import { times } from 'lodash';
import { ReactNode, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, Stack, Text, TextLink, useSplitter, useStyles2, withErrorBoundary } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { EditorColumnHeader } from '../components/contact-points/templates/EditorColumnHeader';

type Domain = [Date, Date];

export const TriagePage = () => {
  const domain = [subDays(new Date(), 7), new Date()];

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
  const [flexSize, setFlexSize] = useState<number>(initialSize);

  // splitter for template and payload editor
  const splitter = useSplitter({
    direction: 'row',
    // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
    initialSize: initialSize,
    dragPosition: 'middle',
    // by updating the flex size on resize, we can force all of the splitter props to be updated for all divs below
    // this is a pretty ugly hack but the best we can do for now
    // @TODO this might make the UI very slow, we'll figure that out later
    onResizing: (flexSize) => setFlexSize(flexSize),
    onSizeChanged: (flexSize) => setFlexSize(flexSize),
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
            <EditorColumnHeader>
              <TimelineHeader domain={domain} />
            </EditorColumnHeader>
          </div>
        </div>
      </div>

      {/* groups go here */}
      <div data-testid="groups-container" className={cx(splitter.containerProps.className, styles.groupsContainer)}>
        {times(50, () => (
          <GroupWrapper flexSize={flexSize} />
        ))}
      </div>
    </div>
  );
}

interface GroupWrapperProps {
  flexSize: number;
}

const GroupWrapper = ({ flexSize }: GroupWrapperProps) => {
  const styles = useStyles2(getStyles);

  // we have to set the flex size on both left and right columns for the column splitter to work properly
  const leftColumnFlex = flexSize;
  const rightColumnFlex = 1 - flexSize;

  return (
    <div className={styles.groupItemWrapper}>
      <div
        style={{ minWidth: 'min-content', flexGrow: leftColumnFlex }}
        className={cx(styles.leftColumn, styles.column)}
      >
        <div className={styles.columnContent}>
          <GroupedItem label={t('alerting.group-wrapper.label-my-service', 'My Service')} />
        </div>
      </div>
      <div
        style={{ minWidth: 'min-content', flexGrow: rightColumnFlex }}
        className={cx(styles.rightColumn, styles.column)}
      >
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
    const xScale = scaleUtc().domain(domain).range([0, width]);
    const tickFormatter = xScale.tickFormat();

    return xScale.ticks(12).map((value) => ({
      value: tickFormatter(value),
      xOffset: xScale(value),
    }));
  }, [domain, width]);

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <Stack flex={1} direction="row" justifyContent="space-between">
        {ticks.map((tick) => (
          <Text variant="bodySmall">{tick.value}</Text>
        ))}
      </Stack>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    groupsContainer: css({
      position: 'absolute',
      width: '100%',
      height: `calc(100% - ${theme.spacing(4)} - 1px)`, // account for border

      display: 'flex',
      flexDirection: 'column',
      marginTop: `calc(${theme.spacing(4)} + 1px)`, // account for border

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
