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
    const handleClick2 = () => {
      console.log('hello world 2');
    };
    const handleClick3 = () => {
      console.log('hello world 3');
    };

    return React.createElement(
      'div',
      { className: 'frontend-sandbox-test' },
      React.createElement(
        'button',
        { onClick: createIframe, 'data-testid': 'button-create-iframes' },
        'Create iframes'
      ),
      React.createElement('button', { onClick: handleClick2, 'data-testid': 'panel-button-2' }, 'Button 2'),
      React.createElement('button', { onClick: handleClick3, 'data-testid': 'panel-button-3' }, 'Button 3')
    );
  };

  const plugin = new grafanaData.PanelPlugin(HelloWorld);

  return { plugin };
});
