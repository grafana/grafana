import React from 'react';
import { appEvents } from 'app/core/core';
import { Icon } from '@grafana/ui';

export class HelpModal extends React.PureComponent {
  static tabIndex = 0;
  static shortcuts = {
    Global: [
      { keys: ['g', 'h'], description: 'Go to Home Dashboard' },
      { keys: ['g', 'p'], description: 'Go to Profile' },
      { keys: ['s', 'o'], description: 'Open search' },
      { keys: ['esc'], description: 'Exit edit/setting views' },
    ],
    Dashboard: [
      { keys: ['mod+s'], description: 'Save dashboard' },
      { keys: ['d', 'r'], description: 'Refresh all panels' },
      { keys: ['d', 's'], description: 'Dashboard settings' },
      { keys: ['d', 'v'], description: 'Toggle in-active / view mode' },
      { keys: ['d', 'k'], description: 'Toggle kiosk mode (hides top nav)' },
      { keys: ['d', 'E'], description: 'Expand all rows' },
      { keys: ['d', 'C'], description: 'Collapse all rows' },
      { keys: ['d', 'a'], description: 'Toggle auto fit panels (experimental feature)' },
      { keys: ['mod+o'], description: 'Toggle shared graph crosshair' },
      { keys: ['d', 'l'], description: 'Toggle all panel legends' },
    ],
    'Focused Panel': [
      { keys: ['e'], description: 'Toggle panel edit view' },
      { keys: ['v'], description: 'Toggle panel fullscreen view' },
      { keys: ['p', 's'], description: 'Open Panel Share Modal' },
      { keys: ['p', 'd'], description: 'Duplicate Panel' },
      { keys: ['p', 'r'], description: 'Remove Panel' },
      { keys: ['p', 'l'], description: 'Toggle panel legend' },
    ],
    'Time Range': [
      { keys: ['t', 'z'], description: 'Zoom out time range' },
      {
        keys: ['t', '←'],
        description: 'Move time range back',
      },
      {
        keys: ['t', '→'],
        description: 'Move time range forward',
      },
    ],
  };

  dismiss() {
    appEvents.emit('hide-modal');
  }

  render() {
    return (
      <div className="modal-body">
        <div className="modal-header">
          <h2 className="modal-header-title">
            <Icon name="keyboard" size="lg" />
            <span className="p-l-1">Shortcuts</span>
          </h2>
          <a className="modal-header-close" onClick={this.dismiss}>
            <Icon name="times" style={{ margin: '3px 0 0 0' }} />
          </a>
        </div>

        <div className="modal-content help-modal">
          <p className="small" style={{ position: 'absolute', top: '13px', right: '44px' }}>
            <span className="shortcut-table-key">mod</span> =
            <span className="muted"> CTRL on windows or linux and CMD key on Mac</span>
          </p>

          {Object.entries(HelpModal.shortcuts).map(([category, shortcuts], i) => (
            <div className="shortcut-category" key={i}>
              <table className="shortcut-table">
                <tbody>
                  <tr>
                    <th className="shortcut-table-category-header" colSpan={2}>
                      {category}
                    </th>
                  </tr>
                  {shortcuts.map((shortcut, j) => (
                    <tr key={`${i}-${j}`}>
                      <td className="shortcut-table-keys">
                        {shortcut.keys.map((key, k) => (
                          <span className="shortcut-table-key" key={`${i}-${j}-${k}`}>
                            {key}
                          </span>
                        ))}
                      </td>
                      <td className="shortcut-table-description">{shortcut.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="clearfix" />
        </div>
      </div>
    );
  }
}
