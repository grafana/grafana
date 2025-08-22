import { css, cx } from '@emotion/css';
import { times } from 'lodash';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink, useSplitter, useStyles2 } from '@grafana/ui';

import { AlertLabels } from '../components/AlertLabels';
import { Label } from '../components/Label';
import { MetaText } from '../components/MetaText';
import { EditorColumnHeader } from '../components/contact-points/templates/EditorColumnHeader';

import { GroupRow } from './GroupRow';
import { StateChangeChart } from './StateChangeChart';
import { TimelineHeader } from './Timeline';
import { Domain, Filter } from './types';

type WorkbenchProps = {
  domain: Domain;
  groupBy?: string[]; // @TODO proper type
  filterBy?: Filter[];
};

const initialSize = 1 / 3;

/**
 * The workbench displays groups of alerts, each group containing metadata and a chart.
 * Alerts can be arbitrarily grouped by any number of labels. By default all instances are grouped by alertname.
 *
 * The page consist of a left column with metadata for the row and a right column with charts.
 * Below is a rough layout of the page:
 *
 * The page is divided into two columns, the size of these columns is determined by the splitter.
 * There is a useMeasure hook to measure the size of the left column, which is used to set the width of the group items.
 * We do this because each row needs to be a flex container such that if the height of the left colorn changes, the
 * right column will also change its height accordingly. This would not be possible if we used a simplified column layout.
 *
 * This also means we draw the rows _on top_ of the splitter, in other words the contents of the splitter are empty
 * and we only use it to determine the width of the left column of the rows that are overlayed on top.
 *
 * Each group is a row with a left and a right column. Each row consists of two cells (the left and the right cell).
 * The left cell contains the metadata for the group, the right cell contains the chart.
 ┌─────────────────────────┐ ┌───────────────────────────────────┐
 │┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
 │                                                               │
 ││                                                Row          ││
 │                                                               │
 │└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
 │┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
 │ ┌──────────────────────┐    ┌───────────────────────────────┐ │
 │││          Cell        │    │              Cell             │││
 │ └──────────────────────┘    └───────────────────────────────┘ │
 │└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
 │                         │ │                                   │
 │                         │││                                   │
 │                         │││                                   │
 │                         │││                                   │
 │                         │ │                                   │
 │                         │ │                                   │
 │                         │ │                                   │
 └─────────────────────────┘ └───────────────────────────────────┘
 */
export function Workbench({ domain }: WorkbenchProps) {
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
          <GroupRow
            width={leftColumnWidth}
            title={
              <TextLink inline={false} href="#">
                {t('alerting.group-wrapper.label-my-service', 'My Service')}
              </TextLink>
            }
            actions={<Label size="sm" value={'service'} />}
            content={<StateChangeChart domain={domain} />}
          >
            <GroupRow
              title={'eu-west'}
              actions={<Label size="sm" value={'region'} />}
              content={<StateChangeChart domain={domain} />}
              width={leftColumnWidth}
            >
              {times(5, () => (
                <GroupRow
                  title={t('alerting.workbench.title-alert-rule-name', 'Alert Rule Name')}
                  metadata={
                    <Stack direction="row" gap={0.5} alignItems="center">
                      <MetaText icon="folder" />
                      <Text variant="bodySmall" color="secondary">
                        {t('alerting.group-wrapper.metadata-1', 'Namespace')}
                      </Text>
                    </Stack>
                  }
                  content={<StateChangeChart domain={domain} />}
                  width={leftColumnWidth}
                >
                  {times(5, () => (
                    <GroupRow
                      title={<AlertLabels size="sm" labels={{ foo: 'bar', team: 'operations' }} />}
                      content={<StateChangeChart domain={domain} />}
                      width={leftColumnWidth}
                    />
                  ))}
                </GroupRow>
              ))}
            </GroupRow>
            <GroupRow
              title={'us-east'}
              actions={<Label size="sm" value={'region'} />}
              content={<StateChangeChart domain={domain} />}
              width={leftColumnWidth}
            >
              {times(5, () => (
                <GroupRow
                  title={t('alerting.workbench.title-alert-rule-name', 'Alert Rule Name')}
                  metadata={
                    <Stack direction="row" gap={0.5} alignItems="center">
                      <MetaText icon="folder" />
                      <Text variant="bodySmall" color="secondary">
                        {t('alerting.group-wrapper.metadata-1', 'Namespace')}
                      </Text>
                    </Stack>
                  }
                  content={<StateChangeChart domain={domain} />}
                  width={leftColumnWidth}
                >
                  {times(5, () => (
                    <GroupRow
                      title={<AlertLabels size="sm" labels={{ foo: 'bar', team: 'operations' }} />}
                      content={<StateChangeChart domain={domain} />}
                      width={leftColumnWidth}
                    />
                  ))}
                </GroupRow>
              ))}
            </GroupRow>
          </GroupRow>
        ))}
      </div>
    </div>
  );
}

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
