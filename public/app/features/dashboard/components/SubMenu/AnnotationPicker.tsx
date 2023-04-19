import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { AnnotationQuery, EventBus, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';
import { LoadingIndicator } from '@grafana/ui/src/components/PanelChrome/LoadingIndicator';

import { AnnotationQueryFinished, AnnotationQueryStarted } from '../../../../types/events';
import { getDashboardQueryRunner } from '../../../query/state/DashboardQueryRunner/DashboardQueryRunner';

export interface AnnotationPickerProps {
  events: EventBus;
  annotation: AnnotationQuery;
  onEnabledChanged: (annotation: AnnotationQuery) => void;
}

export const AnnotationPicker = ({ annotation, events, onEnabledChanged }: AnnotationPickerProps): JSX.Element => {
  const [loading, setLoading] = useState(false);
  const styles = useStyles2(getStyles);
  const onCancel = () => getDashboardQueryRunner().cancel(annotation);

  useEffect(() => {
    const started = events.getStream(AnnotationQueryStarted).subscribe({
      next: (event) => {
        if (event.payload === annotation) {
          setLoading(true);
        }
      },
    });
    const stopped = events.getStream(AnnotationQueryFinished).subscribe({
      next: (event) => {
        if (event.payload === annotation) {
          setLoading(false);
        }
      },
    });

    return () => {
      started.unsubscribe();
      stopped.unsubscribe();
    };
  });

  return (
    <div key={annotation.name} className={styles.annotation}>
      <InlineFieldRow>
        <InlineField
          label={annotation.name}
          disabled={loading}
          data-testid={selectors.pages.Dashboard.SubMenu.Annotations.annotationLabel(annotation.name)}
        >
          <InlineSwitch
            value={annotation.enable}
            onChange={() => onEnabledChanged(annotation)}
            disabled={loading}
            data-testid={selectors.pages.Dashboard.SubMenu.Annotations.annotationToggle(annotation.name)}
          />
        </InlineField>
        <div className={styles.indicator}>
          <LoadingIndicator loading={loading} onCancel={onCancel} />
        </div>
      </InlineFieldRow>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    annotation: css`
      display: inline-block;
      margin-right: ${theme.spacing(1)};

      .fa-caret-down {
        font-size: 75%;
        padding-left: ${theme.spacing(1)};
      }

      .gf-form-inline .gf-form {
        margin-bottom: 0;
      }
    `,
    indicator: css`
      align-self: center;
      padding: 0 ${theme.spacing(0.5)};
    `,
  };
}
