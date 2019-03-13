import React from 'react';

interface SidebarProps {
  children: JSX.Element;
  onThemeSelect: (theme: 'dark' | 'light') => void;
}
const Sidebar = (props: SidebarProps) => {
  return (
    <div
      style={{
        height: '100vh',
        width: '300px',
        overflow: 'auto',
        padding: '20px',
      }}
    >
      <div>
        <select
          onChange={(event: React.FormEvent<HTMLSelectElement>) => {
            // @ts-ignore
            props.onThemeSelect(event.target.value);
          }}
        >
          <option value="">Select theme</option>
          <option value="dark">Grafana dark</option>
          <option value="light">Grafana light</option>
        </select>
      </div>
      <div>{props.children}</div>
    </div>
  );
};

export default Sidebar;
