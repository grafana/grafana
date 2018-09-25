import React from 'react';
import classNames from 'classnames/bind';
import PluginListItem from './PluginListItem';

export default function PluginList({ plugins, layout }) {
  const listStyle = classNames({
    'card-section': true,
    'card-list-layout-grid': layout === 'grid',
    'card-list-layout-list': layout === 'list',
  });

  return (
    <section className={listStyle}>
      <ol className="card-list">
        {plugins.map((plugin, index) => {
          return <PluginListItem plugin={plugin} key={`${plugin.name}-${index}`} />;
        })}
      </ol>
    </section>
  );
}
