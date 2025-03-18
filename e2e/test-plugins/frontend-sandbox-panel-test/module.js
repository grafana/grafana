/*
 * This is a dummy plugin to test the frontend sandbox
 * It is not meant to be used in any other way
 * This file doesn't require any compilation
 */
define(['react', '@grafana/data'], function (React, grafanaData) {
  // This would be a custom editor component
  function Editor() {
    const onChangeInternal = (event) => {
      const outsideEl =
        event.target.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement
          .parentElement.parentElement;
      outsideEl.dataset.sandboxTest = 'panel-editor';
    };
    return React.createElement('input', {
      type: 'text',
      onChange: onChangeInternal,
      'data-testid': 'panel-editor-custom-editor-input',
    });
  }

  const PanelComponent = () => {
    const [testedGlobals, setTestedGlobals] = React.useState([]);
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

      // via append
      const appendIframe = document.createElement('iframe');
      appendIframe.src = 'about:blank';
      appendIframe.id = 'appendIframe';
      appendIframe.style.width = '10%';
      appendIframe.style.height = '10%';
      appendIframe.style.border = 'none';
      document.body.append(appendIframe);

      // via prepend
      const prependIframe = document.createElement('iframe');
      prependIframe.src = 'about:blank';
      prependIframe.id = 'prependIframe';
      prependIframe.style.width = '10%';
      prependIframe.style.height = '10%';
      prependIframe.style.border = 'none';
      document.body.prepend(prependIframe);

      // via after
      const referenceElementAfter = document.createElement('div');
      document.body.appendChild(referenceElementAfter);
      const afterIframe = document.createElement('iframe');
      afterIframe.src = 'about:blank';
      afterIframe.id = 'afterIframe';
      afterIframe.style.width = '10%';
      afterIframe.style.height = '10%';
      afterIframe.style.border = 'none';
      referenceElementAfter.after(afterIframe);

      // via before
      const referenceElementBefore = document.createElement('div');
      document.body.appendChild(referenceElementBefore);
      const beforeIframe = document.createElement('iframe');
      beforeIframe.src = 'about:blank';
      beforeIframe.id = 'beforeIframe';
      beforeIframe.style.width = '10%';
      beforeIframe.style.height = '10%';
      beforeIframe.style.border = 'none';
      referenceElementBefore.before(beforeIframe);

      // via outerHTML
      const outerHTMLIframe = document.createElement('iframe');
      outerHTMLIframe.src = 'about:blank';
      outerHTMLIframe.id = 'outerHTMLIframeTemp';
      outerHTMLIframe.style.width = '10%';
      outerHTMLIframe.style.height = '10%';
      outerHTMLIframe.style.border = 'none';
      document.body.appendChild(outerHTMLIframe);
      outerHTMLIframe.outerHTML =
        '<iframe src="about:blank" id="outerHTMLIframe" style="width: 10%; height: 10%; border: none;"></iframe>';

      // via parseFromString
      const iframeString =
        '<iframe src="about:blank" id="parseFromStringIframe" style="width: 10%; height: 10%; border: none;"></iframe>';
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(iframeString, 'text/html');
      document.body.appendChild(parsedDoc.body.firstChild);

      // via insertBefore
      const referenceForInsertBefore = document.createElement('div');
      document.body.appendChild(referenceForInsertBefore);
      const insertBeforeIframe = document.createElement('iframe');
      insertBeforeIframe.src = 'about:blank';
      insertBeforeIframe.id = 'insertBeforeIframe';
      insertBeforeIframe.style.width = '10%';
      insertBeforeIframe.style.height = '10%';
      insertBeforeIframe.style.border = 'none';
      document.body.insertBefore(insertBeforeIframe, referenceForInsertBefore);

      // via replaceChild
      const replaceChildDiv = document.createElement('div');
      document.body.appendChild(replaceChildDiv);
      const replaceChildIframe = document.createElement('iframe');
      replaceChildIframe.src = 'about:blank';
      replaceChildIframe.id = 'replaceChildIframe';
      replaceChildIframe.style.width = '10%';
      replaceChildIframe.style.height = '10%';
      replaceChildIframe.style.border = 'none';
      document.body.replaceChild(replaceChildIframe, replaceChildDiv);
    };

    const reachOut = (e) => {
      const outsideEl = e.target.parentElement.parentElement.parentElement.parentElement.parentElement;
      outsideEl.dataset.sandboxTest = 'true';
    };

    // a function for each global we want to test
    const globalTests = [
      function () {
        try {
          console.log(window.Prism.languages);
          return 'Prism';
        } catch (e) {}
      },
      function () {
        try {
          console.log(window.jQuery.fn.jquery);
          console.log(window.$.fn.jquery);
          return 'jQuery';
        } catch (e) {}
      },
      function () {
        try {
          console.log(window.locationSandbox);
          return 'location';
        } catch (e) {}
      },
    ];

    // it'll assign a variable with one attribute of the Globals
    // and create a new element with the name of the global.
    const testGlobals = () => {
      const results = globalTests.map((test) => test());
      setTestedGlobals(results);
    };

    const elements = testedGlobals.map((item) => {
      const attributes = { 'data-sandbox-global': `${item}` };
      return React.createElement('div', attributes, item);
    });

    return React.createElement(
      'div',
      { className: 'frontend-sandbox-test' },
      React.createElement(
        'button',
        { onClick: createIframe, 'data-testid': 'button-create-iframes' },
        'Create iframes'
      ),
      React.createElement('button', { onClick: reachOut, 'data-testid': 'button-reach-out' }, 'Reach out'),
      React.createElement('button', { onClick: testGlobals, 'data-testid': 'button-test-globals' }, 'Test Globals'),
      React.createElement('div', null, elements)
    );
  };

  const plugin = new grafanaData.PanelPlugin(PanelComponent);

  plugin.setPanelOptions((builder) => {
    builder.addCustomEditor({
      id: 'buttons',
      path: 'buttons',
      name: 'Button Configuration',
      defaultValue: [{ text: '', datasource: '', query: '' }],
      editor: (props) => React.createElement(Editor, { onChange: props.onChange }),
    });
  });

  return { plugin };
});
