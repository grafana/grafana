import React from 'react';
import { ButtonProps, Elements } from '@jaegertracing/jaeger-ui-components';
import { Button, Input } from '@grafana/ui';

/**
 * Right now Jaeger components need some UI elements to be injected. This is to get rid of AntD UI library that was
 * used by default.
 */

// This needs to be static to prevent remounting on every render.
export const UIElements: Elements = {
  Popover: (() => null as any) as any,
  Tooltip: (() => null as any) as any,
  Icon: (() => null as any) as any,
  Dropdown: (() => null as any) as any,
  Menu: (() => null as any) as any,
  MenuItem: (() => null as any) as any,
  Button: ({ onClick, children, className }: ButtonProps) => (
    <Button variant={'secondary'} onClick={onClick} className={className}>
      {children}
    </Button>
  ),
  Divider,
  Input: props => <Input {...props} />,
  InputGroup: ({ children, className, style }) => (
    <span className={className} style={style}>
      {children}
    </span>
  ),
};

function Divider({ className }: { className?: string }) {
  return (
    <div
      style={{
        display: 'inline-block',
        background: '#e8e8e8',
        width: '1px',
        height: '0.9em',
        margin: '0 8px',
      }}
      className={className}
    />
  );
}
