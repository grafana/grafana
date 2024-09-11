define(['react', '@grafana/data'], function (React, data) {
  'use strict';

  class RootComponent extends React.PureComponent {
    render() {
      return React.createElement('div', { className: 'page-container' }, 'Hello Grafana!');
    }
  }

  const modalId = 'b-app-modal';

  const plugin = new data.AppPlugin().setRootPage(RootComponent).configureExtensionLink({
    title: 'Open from B',
    description: 'Open a modal from plugin B',
    extensionPointId: 'plugins/myorg-extensionpoint-app/actions',
    onClick: function (e, { openModal }) {
      openModal({
        title: 'Modal from app B',
        body: function () {
          return React.createElement('div', { 'data-testid': modalId }, 'From plugin B');
        },
      });
    },
  });

  return { plugin: plugin };
});
