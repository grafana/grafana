import React from 'react';
import { Icon } from '@grafana/ui';

export interface FunctionDescriptor {
  text: string;
  params: string[];
  def: {
    category: string;
    defaultParams: string[];
    description?: string;
    fake: boolean;
    name: string;
    params: string[];
  };
}

export interface FunctionEditorControlsProps {
  onMoveLeft: (func: FunctionDescriptor) => void;
  onMoveRight: (func: FunctionDescriptor) => void;
  onRemove: (func: FunctionDescriptor) => void;
}

const FunctionHelpButton = (props: { description?: string; name: string; onDescriptionShow: () => void }) => {
  if (props.description) {
    return <Icon className="pointer" name="question-circle" onClick={props.onDescriptionShow} />;
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
    func: FunctionDescriptor;
    onDescriptionShow: () => void;
  }
) => {
  const { func, onMoveLeft, onMoveRight, onRemove, onDescriptionShow } = props;
  return (
    <div
      style={{
        display: 'flex',
        width: '60px',
        justifyContent: 'space-between',
      }}
    >
      <Icon name="arrow-left" onClick={() => onMoveLeft(func)} />
      <FunctionHelpButton
        name={func.def.name}
        description={func.def.description}
        onDescriptionShow={onDescriptionShow}
      />
      <Icon name="times" onClick={() => onRemove(func)} />
      <Icon name="arrow-right" onClick={() => onMoveRight(func)} />
    </div>
  );
};
