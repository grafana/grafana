import { css, cx } from '@emotion/css';
import React, { CSSProperties, useCallback, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useDebounce, useToggle } from 'react-use';
import { FixedSizeList } from 'react-window';

import { GrafanaTheme, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import {
  Button,
  Field,
  FilterInput,
  Input,
  InputControl,
  Label,
  LoadingPlaceholder,
  Modal,
  TextArea,
  useStyles,
  useStyles2,
} from '@grafana/ui';

import { dashboardApi } from '../../api/alertingApi';
import { RuleFormValues } from '../../types/rule-form';
import { Annotation } from '../../utils/constants';

import { AnnotationKeyInput } from './AnnotationKeyInput';

const AnnotationsField = () => {
  const styles = useStyles(getStyles);
  const [showPanelSelector, setShowPanelSelector] = useToggle(false);
  const [selectedDashboard, setSelectedDashboard] = useState<string | undefined>(undefined);
  const [selectedPanel, setSelectedPanel] = useState<number | undefined>(undefined);

  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();
  const annotations = watch('annotations');

  const existingKeys = useCallback(
    (index: number): string[] => annotations.filter((_, idx: number) => idx !== index).map(({ key }) => key),
    [annotations]
  );

  const { fields, append, remove } = useFieldArray({ control, name: 'annotations' });

  const onPanelChange = () => {
    // if (!selectedDashboard || !selectedPanel) {
    //   return;
    // }
    //
    // const dashboardFieldIdx = fields.findIndex((f) => f.key === Annotation.dashboardUID);
    // const panelFieldIdx = fields.findIndex((f) => f.key === Annotation.panelID);
    //
    // remove([dashboardFieldIdx, panelFieldIdx]);
    // if (dashboardField) {
    //   dashboardField.value = selectedDashboard;
    // } else {
    // if (dashboardFieldIdx === -1 || panelFieldIdx === -1) {
    // append([
    //   { key: Annotation.dashboardUID, value: selectedDashboard },
    //   { key: Annotation.panelID, value: selectedPanel.toString(10) },
    // ]);
    // } else {
    //   insert(dashboardFieldIdx, { key: Annotation.dashboardUID, value: selectedDashboard });
    //   insert(panelFieldIdx, { key: Annotation.panelID, value: selectedPanel.toString(10) });
    // }
    // }
    // if (panelField) {
    //   panelField.value = selectedPanel.toString(10);
    // } else {
    //   append({ key: Annotation.panelID, value: selectedPanel.toString(10) });
    // }
  };

  return (
    <>
      <Label>Summary and annotations</Label>
      <div className={styles.flexColumn}>
        {fields.map((annotationField, index) => {
          const isUrl = annotations[index]?.key?.toLocaleLowerCase().endsWith('url');
          const ValueInputComponent = isUrl ? Input : TextArea;

          return (
            <div key={annotationField.id} className={styles.flexRow}>
              <Field
                className={styles.field}
                invalid={!!errors.annotations?.[index]?.key?.message}
                error={errors.annotations?.[index]?.key?.message}
                data-testid={`annotation-key-${index}`}
              >
                <InputControl
                  name={`annotations.${index}.key`}
                  defaultValue={annotationField.key}
                  render={({ field: { ref, ...field } }) => (
                    <AnnotationKeyInput
                      {...field}
                      aria-label={`Annotation detail ${index + 1}`}
                      existingKeys={existingKeys(index)}
                      width={18}
                    />
                  )}
                  control={control}
                  rules={{ required: { value: !!annotations[index]?.value, message: 'Required.' } }}
                />
              </Field>
              <Field
                className={cx(styles.flexRowItemMargin, styles.field)}
                invalid={!!errors.annotations?.[index]?.value?.message}
                error={errors.annotations?.[index]?.value?.message}
              >
                <ValueInputComponent
                  data-testid={`annotation-value-${index}`}
                  className={cx(styles.annotationValueInput, { [styles.textarea]: !isUrl })}
                  {...register(`annotations.${index}.value`)}
                  placeholder={isUrl ? 'https://' : `Text`}
                  defaultValue={annotationField.value}
                />
              </Field>
              <Button
                type="button"
                className={styles.flexRowItemMargin}
                aria-label="delete annotation"
                icon="trash-alt"
                variant="secondary"
                onClick={() => remove(index)}
              />
            </div>
          );
        })}
        <Button
          className={styles.addAnnotationsButton}
          icon="plus-circle"
          type="button"
          variant="secondary"
          onClick={() => {
            append({ key: '', value: '' });
          }}
        >
          Add info
        </Button>
        <Button type="button" variant="secondary" onClick={setShowPanelSelector}>
          Set panel and dashboard
        </Button>
        <Modal
          title="Select dashboard and panel"
          closeOnEscape
          isOpen={showPanelSelector}
          onDismiss={setShowPanelSelector}
        >
          <DashboardPicker
            dashboardUid={selectedDashboard}
            panelId={selectedPanel}
            onDashboardChange={setSelectedDashboard}
            onPanelChange={setSelectedPanel}
          />
          <Modal.ButtonRow>
            <Button
              type="button"
              variant="primary"
              disabled={!selectedDashboard && !selectedPanel}
              onClick={onPanelChange}
            >
              Confirm
            </Button>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Modal.ButtonRow>
        </Modal>
      </div>
    </>
  );
};

interface PanelDTO {
  id: number;
  title?: string;
}

function panelSort(a: PanelDTO, b: PanelDTO) {
  if (a.title && b.title) {
    return a.title.localeCompare(b.title);
  }
  if (a.title && !b.title) {
    return 1;
  } else if (!a.title && b.title) {
    return -1;
  }

  return 0;
}

interface DashboardPickerProps {
  dashboardUid?: string;
  panelId?: number;
  onDashboardChange: (uid: string | undefined) => void;
  onPanelChange: (id: number | undefined) => void;
}

const DashboardPicker = ({ dashboardUid, panelId, onDashboardChange, onPanelChange }: DashboardPickerProps) => {
  const styles = useStyles2(getPickerStyles);

  const [dashboardFilter, setDashboardFilter] = useState('');
  const [debouncedDashboardFilter, setDebouncedDashboardFilter] = useState('');

  const [panelFilter, setPanelFilter] = useState('');

  const { useSearchQuery, useDashboardQuery } = dashboardApi;

  const { currentData: filteredDashboards = [], isFetching: isDashSearchFetching } = useSearchQuery({
    query: debouncedDashboardFilter,
  });
  const { currentData: dashboardResult, isFetching: isDashboardFetching } = useDashboardQuery(
    { uid: dashboardUid ?? '' },
    { skip: !dashboardUid }
  );

  useDebounce(
    () => {
      setDebouncedDashboardFilter(dashboardFilter);
    },
    500,
    [dashboardFilter]
  );

  const handleDashboardChange = (dashboardUid: string) => {
    onDashboardChange(dashboardUid);
    onPanelChange(undefined);
  };

  const filteredPanels =
    dashboardResult?.dashboard?.panels
      ?.filter((panel): panel is PanelDTO => panel.title?.includes(panelFilter))
      .sort(panelSort) ?? [];

  const DashboardRow = ({ index, style }: { index: number; style: CSSProperties }) => {
    const dashboard = filteredDashboards[index];
    const isSelected = dashboardUid === dashboard.uid;

    return (
      <div
        title={dashboard.title}
        style={style}
        className={cx(styles.row, { [styles.rowOdd]: index % 2 === 1, [styles.rowSelected]: isSelected })}
        onClick={() => handleDashboardChange(dashboard.uid)}
      >
        {dashboard.title}
      </div>
    );
  };

  const PanelRow = ({ index, style }: { index: number; style: CSSProperties }) => {
    const panel = filteredPanels[index];
    const isSelected = panelId === panel.id;

    return (
      <div
        style={style}
        className={cx(styles.row, { [styles.rowOdd]: index % 2 === 1, [styles.rowSelected]: isSelected })}
        onClick={() => onPanelChange(panel.id)}
      >
        {panel.title || '<No title>'}
      </div>
    );
  };

  return (
    <Stack direction="row" gap={2}>
      <div style={{ flex: 1 }}>
        <FilterInput
          value={dashboardFilter}
          onChange={setDashboardFilter}
          title="Search dashboard"
          placeholder="Search dashboard"
          autoFocus
        />
        {isDashSearchFetching && (
          <LoadingPlaceholder text="Loading dashboards..." className={styles.loadingPlaceholder} />
        )}
        <FixedSizeList itemSize={32} height={550} itemCount={filteredDashboards.length} width="100%">
          {DashboardRow}
        </FixedSizeList>
      </div>
      <div style={{ flex: 1 }}>
        <FilterInput value={panelFilter} onChange={setPanelFilter} title="Search panel" placeholder="Search panel" />
        {!isDashboardFetching && (
          <FixedSizeList itemSize={32} height={550} itemCount={filteredPanels.length} width="100%">
            {PanelRow}
          </FixedSizeList>
        )}
        {!dashboardUid && !isDashboardFetching && <div>Select a dashboard to get a list of available panels</div>}
        {isDashboardFetching && (
          <LoadingPlaceholder text="Loading dashboard..." className={styles.loadingPlaceholder} />
        )}
      </div>
    </Stack>
  );
};

const getPickerStyles = (theme: GrafanaTheme2) => ({
  row: css`
    padding: ${theme.spacing(0.5)};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    border: 2px solid transparent;
  `,
  rowSelected: css`
    border-color: ${theme.colors.border.strong};
  `,
  rowOdd: css`
    background-color: ${theme.colors.background.secondary};
  `,
  loadingPlaceholder: css`
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  `,
});

const getStyles = (theme: GrafanaTheme) => ({
  annotationValueInput: css`
    width: 426px;
  `,
  textarea: css`
    height: 76px;
  `,
  addAnnotationsButton: css`
    flex-grow: 0;
    align-self: flex-start;
    margin-left: 148px;
  `,
  flexColumn: css`
    display: flex;
    flex-direction: column;
  `,
  field: css`
    margin-bottom: ${theme.spacing.xs};
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
  `,
  flexRowItemMargin: css`
    margin-left: ${theme.spacing.xs};
  `,
});

export default AnnotationsField;
