import { cx, css } from '@emotion/css';
import { get as lodashGet } from 'lodash';
import React, { SyntheticEvent, useRef, useState, useMemo } from 'react';
import Draggable from 'react-draggable';
import { Resizable, ResizeCallbackData } from 'react-resizable';
import { useObservable } from 'react-use';

import { GrafanaTheme, Dimensions2D, PanelOptionsEditorBuilder, StandardEditorContext } from '@grafana/data';
import { PanelOptionsSupplier } from '@grafana/data/src/panel/PanelPlugin';
import { NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { IconButton, stylesFactory, useTheme } from '@grafana/ui';
import store from 'app/core/store';
import { GroupState } from 'app/features/canvas/runtime/group';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { fillOptionsPaneItems } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

import { InstanceState, activePanelSubject } from './CanvasPanel';
import { getElementEditor } from './editor/elementEditor';
import { getLayerEditor } from './editor/layerEditor';

type Props = {
  onClose?: () => void;
};

const OFFSET = 8;

export const InlineEdit = ({ onClose }: Props) => {
  const activePanel = useObservable(activePanelSubject);
  const instanceState = activePanel?.panel.context?.instanceState;
  const theme = useTheme();
  const btnInlineEdit = document.querySelector('[data-btninlineedit]')!.getBoundingClientRect();
  const ref = useRef<HTMLDivElement>(null);
  const styles = getStyles(theme);
  const inlineEditKey = 'inlineEditPanel';

  const defaultMeasurements = { width: 350, height: 400 };
  const defaultX = btnInlineEdit.x - btnInlineEdit.width + OFFSET;
  const defaultY = -OFFSET - defaultMeasurements.height;

  const savedPlacement = store.getObject(inlineEditKey, {
    x: defaultX,
    y: defaultY,
    w: defaultMeasurements.width,
    h: defaultMeasurements.height,
  });
  const [measurements, setMeasurements] = useState<Dimensions2D>({ width: savedPlacement.w, height: savedPlacement.h });
  const [placement, setPlacement] = useState({ x: savedPlacement.x, y: savedPlacement.y });

  const pane = useMemo(() => {
    const state: InstanceState = instanceState;
    if (!state) {
      return new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
    }

    const supplier = (builder: PanelOptionsEditorBuilder<any>, context: StandardEditorContext<any>) => {
      builder.addNestedOptions(getLayerEditor(instanceState));

      const selection = state.selected;
      if (selection?.length === 1) {
        const element = selection[0];
        if (!(element instanceof GroupState)) {
          builder.addNestedOptions(
            getElementEditor({
              category: [`Selected element (${element.options.name})`],
              element,
              scene: state.scene,
            })
          );
        }
      }
    };

    return getOptionsPaneCategoryDescriptor({}, supplier);
  }, [instanceState]);

  const onDragStop = (event: any, dragElement: any) => {
    setPlacement({ x: dragElement.x, y: dragElement.y });
    saveToStore(dragElement.x, dragElement.y, measurements.width, measurements.height);
  };

  const onResizeStop = (event: SyntheticEvent<Element, Event>, data: ResizeCallbackData) => {
    const { size } = data;
    setMeasurements({ width: size.width, height: size.height });
    saveToStore(placement.x, placement.y, size.width, size.height);
  };

  const saveToStore = (x: number, y: number, width: number, height: number) => {
    store.setObject(inlineEditKey, { x: x, y: y, w: width, h: height });
  };
  return (
    <Draggable handle="strong" onStop={onDragStop} position={{ x: placement.x, y: savedPlacement.y }}>
      <Resizable height={measurements.height} width={measurements.width} onResize={onResizeStop}>
        <div
          className={cx('box', 'no-cursor', `${styles.inlineEditorContainer}`)}
          style={{ height: `${measurements.height}px`, width: `${measurements.width}px` }}
          ref={ref}
        >
          <strong className={cx('cursor', `${styles.inlineEditorHeader}`)}>
            <div className={styles.placeholder} />
            <div>Canvas Inline Editor</div>
            <IconButton name="times" size="xl" className={styles.inlineEditorClose} onClick={onClose} />
          </strong>
          <div style={{ overflow: 'scroll' }} className={styles.inlineEditorContentWrapper}>
            <div className={styles.inlineEditorContent}>
              <div>
                <div>{pane.items.map((v) => v.render())}</div>
                <div>
                  {pane.categories.map((c) => {
                    return (
                      <div key={c.props.id}>
                        <h5>{c.props.title}</h5>
                        <div>{c.items.map((s) => s.render())}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Resizable>
    </Draggable>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  inlineEditorContainer: css`
    display: flex;
    flex-direction: column;
    background: ${theme.colors.panelBg};
    box-shadow: 5px 5px 20px -5px #000000;
    z-index: 1000;
    opacity: 1;
  `,
  inlineEditorHeader: css`
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${theme.colors.pageHeaderBg};
    border: 1px solid ${theme.colors.pageHeaderBorder};
    height: 40px;
    cursor: move;
  `,
  inlineEditorContent: css`
    white-space: pre-wrap;
    padding: 10px;
  `,
  inlineEditorClose: css`
    margin-left: auto;
  `,
  placeholder: css`
    width: 24px;
    height: 24px;
    visibility: hidden;
    margin-right: auto;
  `,
  inlineEditorContentWrapper: css`
    overflow: scroll;
  `,
}));

// 🤮🤮🤮🤮 this oddly does not actually do anything, but structure is required.  I'll try to clean it up...
function getOptionsPaneCategoryDescriptor<T = any>(
  props: any,
  supplier: PanelOptionsSupplier<T>
): OptionsPaneCategoryDescriptor {
  const context: StandardEditorContext<unknown, unknown> = {
    data: props.input,
    options: props.options,
  };

  const root = new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
  const getOptionsPaneCategory = (categoryNames?: string[]): OptionsPaneCategoryDescriptor => {
    if (categoryNames?.length) {
      const key = categoryNames[0];
      let sub = root.categories.find((v) => v.props.id === key);
      if (!sub) {
        sub = new OptionsPaneCategoryDescriptor({ id: key, title: key });
        root.categories.push(sub);
      }
      return sub;
    }
    return root;
  };

  const access: NestedValueAccess = {
    getValue: (path: string) => lodashGet(props.options, path),
    onChange: (path: string, value: any) => {
      props.onChange(setOptionImmutably(props.options as any, path, value));
    },
  };

  // Use the panel options loader
  fillOptionsPaneItems(supplier, access, getOptionsPaneCategory, context);
  return root;
}
