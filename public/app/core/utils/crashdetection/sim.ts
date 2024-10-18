export const crashme = {
  memoryCrash: function () {
    let dump = [];
    let dumps = {};

    setInterval(() => {
      for (let i = 0; i < 1000000; i++) {
        if (dump.length > 1000000) {
          dumps[Object.keys(dumps).length] = dump;
          dump = [];
        }
        dump.push(Math.random());
      }
    }, 1);
  },
  loopCrash: function () {
    let i = 0;
    while (true) {
      i++;
    }
  },
  recursiveCrash: function () {
    crashme.recursiveCrash();
    crashme.recursiveCrash();
    crashme.recursiveCrash();
  },
  domCrash: function () {
    const div = document.createElement('div');
    document.body.appendChild(div);
    while (true) {
      const child = div.cloneNode();
      document.body.appendChild(child);
    }
  },
};
