import React, { Suspense } from 'react';

import { Icon, Tooltip } from '@grafana/ui';

import { FuncInstance } from '../gfunc';

export interface FunctionEditorControlsProps {
  onMoveLeft: (func: FuncInstance) => void;
  onMoveRight: (func: FuncInstance) => void;
  onRemove: (func: FuncInstance) => void;
}

const FunctionDescription = React.lazy(async () => {
  return {
    default(props: { description?: string }) {
      return <div>{props.description}</div>;
    },
  };
});

const FunctionHelpButton = (props: { description?: string; name: string }) => {
  if (props.description) {
    let tooltip = (
      <Suspense fallback={<span>Loading description...</span>}>
        <FunctionDescription description={props.description} />
      </Suspense>
    );
    return (
      <Tooltip content={tooltip} placement={'bottom-end'}>
        <Icon className={props.description ? undefined : 'pointer'} name="question-circle" />
      </Tooltip>
    );
  }

  return (
    <Icon
      className="pointer"
      name="question-circle"
      onClick={() => {
        window.open(
          'http://graphite.readthedocs.org/en/latest/functions.html#graphite.render.functions.' + props.name,
          '_blank'
        );
      }}
    />
  );
};

export const FunctionEditorControls = (
  props: FunctionEditorControlsProps & {
    func: FuncInstance;
  }
) => {
  const { func, onMoveLeft, onMoveRight, onRemove } = props;
  return (
    <div
      style={{
        display: 'flex',
        width: '60px',
        justifyContent: 'space-between',
      }}
    >
      <Icon name="arrow-left" onClick={() => onMoveLeft(func)} />
      <FunctionHelpButton name={func.def.name} description={func.def.description} />
      <Icon name="times" onClick={() => onRemove(func)} />
      <Icon name="arrow-right" onClick={() => onMoveRight(func)} />
    </div>
  );
};
