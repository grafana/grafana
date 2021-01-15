import React, { useRef } from 'react';
import { SelectionPlugin } from './SelectionPlugin';
import { css } from 'emotion';
import { Button } from '../../Button';
import useClickAway from 'react-use/lib/useClickAway';

interface AnnotationsEditorPluginProps {
  onAnnotationCreate: () => void;
}

/**
 * @alpha
 */
export const AnnotationsEditorPlugin: React.FC<AnnotationsEditorPluginProps> = ({ onAnnotationCreate }) => {
  const pluginId = 'AnnotationsEditorPlugin';

  return (
    <SelectionPlugin
      id={pluginId}
      onSelect={selection => {
        console.log(selection);
      }}
      lazy
    >
      {({ selection, clearSelection }) => {
        return <AnnotationEditor selection={selection} onClose={clearSelection} />;
      }}
    </SelectionPlugin>
  );
};

const AnnotationEditor: React.FC<any> = ({ onClose, selection }) => {
  const ref = useRef(null);

  useClickAway(ref, () => {
    if (onClose) {
      onClose();
    }
  });

  return (
    <div>
      <div
        ref={ref}
        className={css`
          position: absolute;
          background: purple;
          top: ${selection.bbox.top}px;
          left: ${selection.bbox.left}px;
          width: ${selection.bbox.width}px;
          height: ${selection.bbox.height}px;
        `}
      >
        Annotations editor maybe?
        <Button onClick={() => {}}>Create annotation</Button>
      </div>
    </div>
  );
};
