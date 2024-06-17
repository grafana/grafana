define(['react', '@grafana/data', '@grafana/ui', '@grafana/runtime', '@emotion/css', 'rxjs'], function (
  React,
  data,
  ui,
  runtime,
  css,
  rxjs
) {
  'use strict';

  const styles = {
    modalBody: 'ape-modal-body',
    mainPageContainer: 'ape-main-page-container',
  };

  class RootComponent extends React.PureComponent {
    render() {
      return React.createElement(
        'div',
        { 'data-testid': styles.mainPageContainer, className: 'page-container' },
        'Hello Grafana!'
      );
    }
  }

  const asyncWrapper = (fn) => {
    return function () {
      const gen = fn.apply(this, arguments);
      return new Promise((resolve, reject) => {
        function step(key, arg) {
          let info, value;
          try {
            info = gen[key](arg);
            value = info.value;
          } catch (error) {
            reject(error);
            return;
          }
          if (info.done) {
            resolve(value);
          } else {
            Promise.resolve(value).then(next, throw_);
          }
        }
        function next(value) {
          step('next', value);
        }
        function throw_(value) {
          step('throw', value);
        }
        next();
      });
    };
  };

  const getStyles = (theme) => ({
    colorWeak: css.css`color: ${theme.colors.text.secondary};`,
    marginTop: css.css`margin-top: ${theme.spacing(3)};`,
  });

  const updatePlugin = asyncWrapper(function* (pluginId, settings) {
    const response = runtime
      .getBackendSrv()
      .fetch({ url: `/api/plugins/${pluginId}/settings`, method: 'POST', data: settings });
    return rxjs.lastValueFrom(response);
  });

  const handleUpdate = asyncWrapper(function* (pluginId, settings) {
    try {
      yield updatePlugin(pluginId, settings);
      window.location.reload();
    } catch (error) {
      console.error('Error while updating the plugin', error);
    }
  });

  const configPageBody = ({ plugin }) => {
    const styles = getStyles(ui.useStyles2());
    const { enabled, jsonData } = plugin.meta;
    return React.createElement(
      'div',
      null,
      React.createElement(ui.Legend, null, 'Enable / Disable '),
      !enabled &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement('div', { className: styles.colorWeak }, 'The plugin is currently not enabled.'),
          React.createElement(
            ui.Button,
            {
              className: styles.marginTop,
              variant: 'primary',
              onClick: () => handleUpdate(plugin.meta.id, { enabled: true, pinned: true, jsonData: jsonData }),
            },
            'Enable plugin'
          )
        ),
      enabled &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement('div', { className: styles.colorWeak }, 'The plugin is currently enabled.'),
          React.createElement(
            ui.Button,
            {
              className: styles.marginTop,
              variant: 'destructive',
              onClick: () => handleUpdate(plugin.meta.id, { enabled: false, pinned: false, jsonData: jsonData }),
            },
            'Disable plugin'
          )
        )
    );
  };

  const selectQueryModal = ({ targets = [], onDismiss }) => {
    const [selectedQuery, setSelectedQuery] = React.useState(targets[0]);
    return React.createElement(
      'div',
      { 'data-testid': styles.modalBody },
      React.createElement(
        'p',
        null,
        'Please select the query you would like to use to create "something" in the plugin.'
      ),
      React.createElement(
        ui.HorizontalGroup,
        null,
        targets.map((query) =>
          React.createElement(ui.FilterPill, {
            key: query.refId,
            label: query.refId,
            selected: query.refId === (selectedQuery ? selectedQuery.refId : null),
            onClick: () => setSelectedQuery(query),
          })
        )
      ),
      React.createElement(
        ui.Modal.ButtonRow,
        null,
        React.createElement(ui.Button, { variant: 'secondary', fill: 'outline', onClick: onDismiss }, 'Cancel'),
        React.createElement(
          ui.Button,
          {
            disabled: !Boolean(selectedQuery),
            onClick: () => {
              onDismiss && onDismiss();
              alert(`You selected query "${selectedQuery.refId}"`);
            },
          },
          'OK'
        )
      )
    );
  };

  const plugin = new data.AppPlugin()
    .setRootPage(RootComponent)
    .addConfigPage({
      title: 'Configuration',
      icon: 'cog',
      body: configPageBody,
      id: 'configuration',
    })
    .configureExtensionLink({
      title: 'Open from time series or pie charts (path)',
      description: 'This link will only be visible on time series and pie charts',
      extensionPointId: data.PluginExtensionPoints.DashboardPanelMenu,
      path: `/a/myorg-extensions-app/`,
      configure: (context) => {
        if (context.dashboard?.title === 'Link Extensions (path)') {
          switch (context.pluginId) {
            case 'timeseries':
              return {};
            case 'piechart':
              return { title: `Open from ${context.pluginId}` };
            default:
              return;
          }
        }
      },
    })
    .configureExtensionLink({
      title: 'Open from time series or pie charts (onClick)',
      description: 'This link will only be visible on time series and pie charts',
      extensionPointId: data.PluginExtensionPoints.DashboardPanelMenu,
      onClick: (_, { context, openModal }) => {
        const targets = context?.targets || [];
        const title = context?.title;
        if (!targets.length) return;
        if (targets.length > 1) {
          openModal({
            title: `Select query from "${title}"`,
            body: (props) => React.createElement(selectQueryModal, { ...props, targets: targets }),
          });
        } else {
          alert(`You selected query "${targets[0].refId}"`);
        }
      },
      configure: (context) => {
        if (context.dashboard?.title === 'Link Extensions (onClick)') {
          switch (context.pluginId) {
            case 'timeseries':
              return {};
            case 'piechart':
              return { title: `Open from ${context.pluginId}` };
            default:
              return;
          }
        }
      },
    });

  return { plugin: plugin };
});
