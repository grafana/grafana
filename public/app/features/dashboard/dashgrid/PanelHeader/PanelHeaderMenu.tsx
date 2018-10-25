import React, { PureComponent } from 'react';
// import { store } from 'app/store/configureStore';
import { PanelHeaderMenuItem, PanelHeaderMenuItemTypes } from './PanelHeaderMenuItem';
import appEvents from 'app/core/app_events';
import { store } from 'app/store/configureStore';
import { updateLocation } from 'app/core/actions';

export interface PanelHeaderMenuProps {
  panelId: number;
}

export class PanelHeaderMenu extends PureComponent<PanelHeaderMenuProps, any> {
  onEditPanel = () => {
    store.dispatch(
      updateLocation({
        query: {
          panelId: this.props.panelId,
          edit: true,
          fullscreen: true,
        },
      })
    );
  };

  onViewPanel = () => {
    store.dispatch(
      updateLocation({
        query: {
          panelId: this.props.panelId,
          edit: false,
          fullscreen: true,
        },
      })
    );
  };

  onRemovePanel = () => {
    appEvents.emit('panel-remove', {
      panelId: this.props.panelId,
    });
  };

  render() {
    return (
      <div className="panel-menu-container dropdown">
        <ul className="dropdown-menu dropdown-menu--menu panel-menu" role="menu">
          <PanelHeaderMenuItem
            type={PanelHeaderMenuItemTypes.Link}
            text="View"
            iconClassName="fa fa-fw fa-eye"
            handleClick={this.onViewPanel}
            shortcut="v"
          />
          <PanelHeaderMenuItem
            type={PanelHeaderMenuItemTypes.Link}
            text="Edit"
            iconClassName="fa fa-fw fa-edit"
            handleClick={this.onEditPanel}
            shortcut="e"
          />
          <PanelHeaderMenuItem
            type={PanelHeaderMenuItemTypes.Link}
            text="Share"
            iconClassName="fa fa-fw fa-share"
            handleClick={() => {}}
            shortcut="p s"
          />
          <PanelHeaderMenuItem
            type={PanelHeaderMenuItemTypes.SubMenu}
            text="More ..."
            iconClassName="fa fa-fw fa-cube"
            handleClick={() => {}}
          >
            <ul className="dropdown-menu dropdown-menu--menu panel-menu">
              <PanelHeaderMenuItem
                type={PanelHeaderMenuItemTypes.Link}
                text="Duplicate"
                iconClassName=""
                handleClick={() => {}}
                shortcut="p d"
              />

              <PanelHeaderMenuItem type={PanelHeaderMenuItemTypes.Link} text="Copy" handleClick={() => {}} />

              <PanelHeaderMenuItem type={PanelHeaderMenuItemTypes.Link} text="Panel JSON" handleClick={() => {}} />

              <PanelHeaderMenuItem type={PanelHeaderMenuItemTypes.Link} text="Export CSV" handleClick={() => {}} />

              <PanelHeaderMenuItem
                type={PanelHeaderMenuItemTypes.Link}
                text="Toggle legend"
                handleClick={() => {}}
                shortcut="p l"
              />
            </ul>
          </PanelHeaderMenuItem>
          <PanelHeaderMenuItem type={PanelHeaderMenuItemTypes.Divider} />
          <PanelHeaderMenuItem
            type={PanelHeaderMenuItemTypes.Link}
            text="Remove"
            iconClassName="fa fa-fw fa-trash"
            handleClick={this.onRemovePanel}
            shortcut="p r"
          />
        </ul>
      </div>
    );
  }
}
