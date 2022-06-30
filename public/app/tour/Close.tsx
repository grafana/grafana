import React, { FC } from 'react';
import { IconButton } from '@grafana/ui';
import { CloseProps } from '@reactour/tour/dist/components/Close';

const Close: FC<CloseProps> = ({ onClick }) => (
  <IconButton
    style={{ position: 'absolute', right: 10, top: 10, outline: 'none', margin: 0 }}
    onClick={onClick}
    name="times"
    size="lg"
  />
);

export default Close;
