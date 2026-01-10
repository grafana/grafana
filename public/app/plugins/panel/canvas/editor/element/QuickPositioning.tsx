import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PositionDimensionConfig, PositionDimensionMode } from '@grafana/schema';
import { IconButton, useStyles2 } from '@grafana/ui';
import { ElementState } from 'app/features/canvas/runtime/element';
import { QuickPlacement } from 'app/features/canvas/types';

import { HorizontalConstraint, VerticalConstraint, Placement } from '../../panelcfg.gen';

import { CanvasEditorOptions } from './elementEditor';

type Props = {
  onPositionChange: (value: PositionDimensionConfig | undefined, placement: keyof Placement) => void;
  element: ElementState;
  settings: CanvasEditorOptions;
};

export const QuickPositioning = ({ onPositionChange, element, settings }: Props) => {
  const styles = useStyles2(getStyles);

  // Helper to get numeric value from PositionDimensionConfig
  const getPositionValue = (config: PositionDimensionConfig | undefined): number => {
    return config?.fixed ?? 0;
  };

  // Helper to create a fixed PositionDimensionConfig
  const fixedPosition = (value: number): PositionDimensionConfig => ({
    fixed: value,
    mode: PositionDimensionMode.Fixed,
  });

  const onQuickPositioningChange = (position: QuickPlacement) => {
    const defaultConstraint = { vertical: VerticalConstraint.Top, horizontal: HorizontalConstraint.Left };
    const originalConstraint = { ...element.options.constraint };

    element.options.constraint = defaultConstraint;
    element.setPlacementFromConstraint();

    const height = getPositionValue(element.options.placement?.height);
    const width = getPositionValue(element.options.placement?.width);

    switch (position) {
      case QuickPlacement.Top:
        onPositionChange(fixedPosition(0), 'top');
        break;
      case QuickPlacement.Bottom:
        onPositionChange(fixedPosition(getRightBottomPosition(height, 'bottom')), 'top');
        break;
      case QuickPlacement.VerticalCenter:
        onPositionChange(fixedPosition(getCenterPosition(height, 'v')), 'top');
        break;
      case QuickPlacement.Left:
        onPositionChange(fixedPosition(0), 'left');
        break;
      case QuickPlacement.Right:
        onPositionChange(fixedPosition(getRightBottomPosition(width, 'right')), 'left');
        break;
      case QuickPlacement.HorizontalCenter:
        onPositionChange(fixedPosition(getCenterPosition(width, 'h')), 'left');
        break;
    }

    element.options.constraint = originalConstraint;
    element.setPlacementFromConstraint();
  };

  // Basing this on scene will mean that center is based on root for the time being
  const getCenterPosition = (elementSize: number, align: 'h' | 'v') => {
    const sceneSize = align === 'h' ? settings.scene.width : settings.scene.height;

    return (sceneSize - elementSize) / 2;
  };

  const getRightBottomPosition = (elementSize: number, align: 'right' | 'bottom') => {
    const sceneSize = align === 'right' ? settings.scene.width : settings.scene.height;

    return sceneSize - elementSize;
  };

  return (
    <div className={styles.buttonGroup}>
      <IconButton
        name="horizontal-align-left"
        onClick={() => onQuickPositioningChange(QuickPlacement.Left)}
        className={styles.button}
        size="lg"
        tooltip={t('canvas.quick-positioning.tooltip-align-left', 'Align left')}
      />
      <IconButton
        name="horizontal-align-center"
        onClick={() => onQuickPositioningChange(QuickPlacement.HorizontalCenter)}
        className={styles.button}
        size="lg"
        tooltip={t('canvas.quick-positioning.tooltip-align-horizontal-centers', 'Align horizontal centers')}
      />
      <IconButton
        name="horizontal-align-right"
        onClick={() => onQuickPositioningChange(QuickPlacement.Right)}
        className={styles.button}
        size="lg"
        tooltip={t('canvas.quick-positioning.tooltip-align-right', 'Align right')}
      />
      <IconButton
        name="vertical-align-top"
        onClick={() => onQuickPositioningChange(QuickPlacement.Top)}
        size="lg"
        tooltip={t('canvas.quick-positioning.tooltip-align-top', 'Align top')}
      />
      <IconButton
        name="vertical-align-center"
        onClick={() => onQuickPositioningChange(QuickPlacement.VerticalCenter)}
        className={styles.button}
        size="lg"
        tooltip={t('canvas.quick-positioning.tooltip-align-vertical-centers', 'Align vertical centers')}
      />
      <IconButton
        name="vertical-align-bottom"
        onClick={() => onQuickPositioningChange(QuickPlacement.Bottom)}
        className={styles.button}
        size="lg"
        tooltip={t('canvas.quick-positioning.tooltip-align-bottom', 'Align bottom')}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  buttonGroup: css({
    display: 'flex',
    flexWrap: 'wrap',
    padding: '12px 0 12px 0',
  }),
  button: css({
    marginLeft: '5px',
    marginRight: '5px',
  }),
});
