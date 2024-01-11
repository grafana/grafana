import React, { CSSProperties } from 'react';

import { CloseButton } from 'app/core/components/CloseButton/CloseButton';

export function ExemplarModalHeader(props: { onClick: () => void; style?: React.CSSProperties }) {
  const defaultStyle: CSSProperties = {
    position: 'relative',
    top: 'auto',
    right: 'auto',
    marginRight: 0,
  };

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'flex-end',
        paddingBottom: '6px',
      }}
    >
      <CloseButton onClick={props.onClick} style={props.style ?? defaultStyle} />
    </div>
  );
}
