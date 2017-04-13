/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

/* global Worker, Blob, URL */

class AdremWebWorker {

  constructor(workerUrl) {
    const
      tasks = new Map(),
      webWorker = new Worker(workerUrl);

    function getTaskId() {
      let taskId = (new Date()).getTime();
      while (tasks.has(taskId)) {
        taskId += 1;
      }
      return taskId;
    }

    webWorker.onmessage = (event) => {
      const taskId = event.data.taskId;
      if (tasks.has(taskId)) {
        const resolve = tasks.get(taskId);
        tasks.delete(taskId);
        resolve(event.data.result);
      }
    };

    this.executeTask = (taskData) => {
      const
        taskId = getTaskId(),
        data = taskData;
      data.taskId = taskId;
      return new Promise((resolve) => {
        tasks.set(taskId, resolve);
        webWorker.postMessage(data);
      });
    };

  }

  addTask(taskSpec) {
    // eslint-disable-next-line
    this[taskSpec.name] = function(...args) {
      const task = {
        funcName: taskSpec.name,
        args,
        async: taskSpec.async
      };

      if (taskSpec.async === true) {
        const self = this;
        return new Promise((resolve, reject) => {
          self.executeTask(task)
            .then((result) => {
              if (result.type === 'resolve') {
                resolve(result.result);
              }
              if (result.type === 'reject') {
                reject(result.error);
              }
            });
        });
      }

      return this.executeTask(task);
    };
  }

  static webWorkerBuilder() {
    const
      workerCode = [],
      taskInterfaces = [];

    function getCodeBlob() {

      function getAdremTaskDispatcher() {
        const globalScope = this;

        function postResult(taskId, result) {
          globalScope.postMessage({
            taskId,
            result
          });
        }

        function executeSyncFunc(taskId, funcName, args) {
          // eslint-disable-next-line
          postResult(taskId, globalScope[funcName].apply(globalScope, args));
        }

        function executeAsyncFunc(taskId, funcName, args) {
          // eslint-disable-next-line
          globalScope[funcName].apply(globalScope, args)
            .then(result => postResult(taskId, {
              type: 'resolve',
              result
            }))
            .catch(error => postResult(taskId, {
              type: 'reject',
              error
            }));
        }

        function taskDispatcher(event) {
          const eventData = event.data;
          if (eventData.async !== true) {
            executeSyncFunc(eventData.taskId, eventData.funcName, eventData.args);
          } else {
            executeAsyncFunc(eventData.taskId, eventData.funcName, eventData.args);
          }
        }

        return taskDispatcher;
      }

      function getTaskDispatchingSetup() {
        return `this.onmessage = ${getAdremTaskDispatcher.name}().bind(this);\n\n`;
      }

      let bundledCode;
      bundledCode = getTaskDispatchingSetup();
      bundledCode += `${getAdremTaskDispatcher.toString()}\n`;
      bundledCode += workerCode.reduce((prev, curr) => `${prev}\n${curr}`, '');
      return new Blob([bundledCode], { type: 'application/javascript' });
    }

    function getBlobURL() {
      return URL.createObjectURL(getCodeBlob());
    }

    function addFunctionCode(code, createInterface = false, async = false) {
      if (typeof code === 'function') {
        workerCode.push(code.toString());
        if ((createInterface === true) && (code.name != null) && (code.name !== '')) {
          taskInterfaces.push({
            name: code.name,
            async
          });
        }
        return true;
      }
      return false;
    }

    function getWebWorker() {
      const webWorker = new AdremWebWorker(getBlobURL());
      taskInterfaces.forEach((taskSpec) => {
        webWorker.addTask(taskSpec);
      });
      return webWorker;
    }

    return {
      addFunctionCode,
      getWebWorker
    };
  }

}

export {
  AdremWebWorker
};
