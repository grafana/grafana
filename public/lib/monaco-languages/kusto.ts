declare global {
  interface Window {
    __monacoKustoResolvePromise: (value: unknown) => void;
    __grafana_public_path__: string;
  }
}

const monacoPath = (window.__grafana_public_path__ ?? 'public/') + 'lib/monaco/min/vs';

const scripts = [
  [`${monacoPath}/language/kusto/bridge.min.js`],
  [
    `${monacoPath}/language/kusto/kusto.javascript.client.min.js`,
    `${monacoPath}/language/kusto/newtonsoft.json.min.js`,
    `${monacoPath}/language/kusto/Kusto.Language.Bridge.min.js`,
  ],
];

function loadScript(script: HTMLScriptElement | string): Promise<void> {
  return new Promise((resolve, reject) => {
    let scriptEl: HTMLScriptElement;

    if (typeof script === 'string') {
      scriptEl = document.createElement('script');
      scriptEl.src = script;
    } else {
      scriptEl = script;
    }

    scriptEl.onload = () => resolve();
    scriptEl.onerror = (err) => reject(err);
    document.body.appendChild(scriptEl);
  });
}

const loadMonacoKusto = () => {
  return new Promise((resolve) => {
    window.__monacoKustoResolvePromise = resolve;

    const script = document.createElement('script');
    script.innerHTML = `require(['vs/language/kusto/monaco.contribution'], function() {
      window.__monacoKustoResolvePromise();
    });`;

    return document.body.appendChild(script);
  });
};

export default async function loadKusto() {
  let promise = Promise.resolve();

  for (const parallelScripts of scripts) {
    await promise;

    // Load all these scripts in parallel, then wait for them all to finish before continuing
    // to the next iteration
    const allPromises = parallelScripts
      .filter((src) => !document.querySelector(`script[src="${src}"]`))
      .map((src) => loadScript(src));

    await Promise.all(allPromises);
  }

  await loadMonacoKusto();
}
