import React, { SFC } from 'react';
import { Plugin } from 'app/types';

interface Props {
  plugin: Plugin;
}

const PluginListItem: SFC<Props> = props => {
  const { plugin } = props;

  return (
    <li className="card-item-wrapper">
      <a className="card-item" href={`plugins/${plugin.id}/edit`}>
        <div className="card-item-header">
          <div className="card-item-type">
            <i className={`icon-gf icon-gf-${plugin.type}`} />
            {plugin.type}
          </div>
          {plugin.hasUpdate && (
            <div className="card-item-notice">
              <span bs-tooltip="plugin.latestVersion">Update available!</span>
            </div>
          )}
        </div>
        <div className="card-item-body">
          <figure className="card-item-figure">
            <img src={plugin.info.logos.small} />
          </figure>
          <div className="card-item-details">
            <div className="card-item-name">{plugin.name}</div>
            <div className="card-item-sub-name">{`By ${plugin.info.author.name}`}</div>
          </div>
        </div>
      </a>
    </li>
  );
};

export default PluginListItem;
