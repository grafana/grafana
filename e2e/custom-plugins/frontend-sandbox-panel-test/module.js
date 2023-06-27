/*
 * This is a dummy plugin to test the frontend sandbox
 * It is not meant to be used in any other way
 * This file doesn't require any compilation
 */
define(['react', '@grafana/data'], function (React, grafanaData) {
  const HelloWorld = () => {
    const createIframe = () => {
      // direct iframe creation
      const iframe = document.createElement('iframe');
      iframe.src = 'about:blank';
      iframe.id = 'createElementIframe';
      iframe.style.width = '10%';
      iframe.style.height = '10%';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      // via innerHTML
      const div = document.createElement('div');
      document.body.appendChild(div);
      div.innerHTML =
        '<iframe src="about:blank" id="innerHTMLIframe" style="width: 10%; height: 10%; border: none;"></iframe>';

      const adjacentIframe = `<iframe src="about:blank" id="adjacentIframe" width="10%" height="10%" frameBorder="0"></iframe>`;
      document.querySelector('body').insertAdjacentHTML('beforeend', adjacentIframe);
    };
    const reachOut = (e) => {
      const outsideEl = e.target.parentElement.parentElement.parentElement.parentElement.parentElement;
      outsideEl.dataset.sandboxTest = 'true';
    };

    return React.createElement(
      'div',
      { className: 'frontend-sandbox-test' },
      React.createElement(
        'button',
        { onClick: createIframe, 'data-testid': 'button-create-iframes' },
        'Create iframes'
      ),
      React.createElement('button', { onClick: reachOut, 'data-testid': 'button-reach-out' }, 'Reach out')
    );
  };

  const plugin = new grafanaData.PanelPlugin(HelloWorld);

  return { plugin };
});
