define(['@grafana/data', 'react', '@grafana/ui', '@grafana/runtime'], function (data, React, UI, runtime) {
  'use strict';

  const styles = {
    container: 'main-app-body',
    actions: { button: 'action-button' },
    modal: { container: 'container', open: 'open-link' },
    appA: { container: 'a-app-body' },
    appB: { modal: 'b-app-modal' },
  };

  function ModalComponent({ onDismiss, title, path }) {
    return React.createElement(
      UI.Modal,
      { 'data-testid': styles.modal.container, title, isOpen: true, onDismiss },
      React.createElement(
        UI.VerticalGroup,
        { spacing: 'sm' },
        React.createElement('p', null, 'Do you want to proceed in the current tab or open a new tab?')
      ),
      React.createElement(
        UI.Modal.ButtonRow,
        null,
        React.createElement(UI.Button, { onClick: onDismiss, fill: 'outline', variant: 'secondary' }, 'Cancel'),
        React.createElement(
          UI.Button,
          {
            type: 'submit',
            variant: 'secondary',
            onClick: function () {
              window.open(data.locationUtil.assureBaseUrl(path), '_blank');
              onDismiss();
            },
            icon: 'external-link-alt',
          },
          'Open in new tab'
        ),
        React.createElement(
          UI.Button,
          {
            'data-testid': styles.modal.open,
            type: 'submit',
            variant: 'primary',
            onClick: function () {
              runtime.locationService.push(path);
            },
            icon: 'apps',
          },
          'Open'
        )
      )
    );
  }

  function ActionComponent({ extensions }) {
    const options = React.useMemo(
      function () {
        return extensions.reduce(function (acc, extension) {
          if (runtime.isPluginExtensionLink(extension)) {
            acc.push({ label: extension.title, title: extension.title, value: extension });
          }
          return acc;
        }, []);
      },
      [extensions]
    );

    const [selected, setSelected] = React.useState();

    return options.length === 0
      ? React.createElement(UI.Button, null, 'Run default action')
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(
            UI.ButtonGroup,
            null,
            React.createElement(
              UI.ToolbarButton,
              {
                key: 'default-action',
                variant: 'canvas',
                onClick: function () {
                  alert('You triggered the default action');
                },
              },
              'Run default action'
            ),
            React.createElement(UI.ButtonSelect, {
              'data-testid': styles.actions.button,
              key: 'select-extension',
              variant: 'canvas',
              options: options,
              onChange: function (e) {
                const extension = e.value;
                if (runtime.isPluginExtensionLink(extension)) {
                  if (extension.path) setSelected(extension);
                  if (extension.onClick) extension.onClick();
                }
              },
            })
          ),
          selected &&
            selected.path &&
            React.createElement(ModalComponent, {
              title: selected.title,
              path: selected.path,
              onDismiss: function () {
                setSelected(undefined);
              },
            })
        );
  }

  class RootComponent extends React.PureComponent {
    render() {
      const { extensions } = runtime.getPluginExtensions({
        extensionPointId: 'plugins/myorg-extensionpoint-app/actions',
        context: {},
      });

      return React.createElement(
        'div',
        { 'data-testid': styles.container, style: { marginTop: '5%' } },
        React.createElement(
          UI.HorizontalGroup,
          { align: 'flex-start', justify: 'center' },
          React.createElement(
            UI.HorizontalGroup,
            null,
            React.createElement('span', null, 'Hello Grafana! These are the actions you can trigger from this plugin'),
            React.createElement(ActionComponent, { extensions: extensions })
          )
        )
      );
    }
  }

  const plugin = new data.AppPlugin().setRootPage(RootComponent);
  return { plugin: plugin };
});
