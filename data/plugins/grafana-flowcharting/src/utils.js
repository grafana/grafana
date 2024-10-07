const pako = require('pako');
const vkbeautify = require('vkbeautify');

// sources :
// https://jgraph.github.io/drawio-tools/tools/convert.html

module.exports = {
  stringToBytes(str) {
    const arr = new Array(str.length);

    for (let i = 0; i < str.length; i += 1) {
      arr[i] = str.charCodeAt(i);
    }

    return arr;
  },
  bytesToString(arr) {
    let str = '';

    for (let i = 0; i < arr.length; i += 1) {
      str += String.fromCharCode(arr[i]);
    }
    return str;
  },
  encode(data, encode, deflate, base64) {
    let result = data;
    if (encode) {
      try {
        result = encodeURIComponent(result);
      } catch (e) {
        console.error(e);
        return;
      }
    }

    if (deflate && result.length > 0) {
      try {
        result = this.bytesToString(pako.deflateRaw(result));
      } catch (e) {
        console.error(e);
        return;
      }
    }

    if (base64) {
      try {
        result = btoa(result);
      } catch (e) {
        console.error(e);
        return;
      }
    }
    return result;
  },

  removeLinebreaks(data) {
    return data.replace(/(\r\n|\n|\r)/gm, '');
  },

  isencoded(data) {
    try {
      const node = this.parseXml(data).documentElement;
      if (node != null && node.nodeName == 'mxfile') {
        const diagrams = node.getElementsByTagName('diagram');
        if (diagrams.length > 0) {
          return true;
        }
      } else return data.indexOf('mxGraphModel') == -1;
    } catch (error) {
      return true;
    }
    return false;
  },

  decode(data, encode, deflate, base64) {
    try {
      const node = this.parseXml(data).documentElement;

      if (node != null && node.nodeName == 'mxfile') {
        const diagrams = node.getElementsByTagName('diagram');

        if (diagrams.length > 0) {
          data = this.getTextContent(diagrams[0]);
        }
      }
    } catch (e) {
      // ignore
    }

    if (base64) {
      try {
        data = atob(data);
      } catch (e) {
        console.error(e);
        return;
      }
    }

    if (deflate && data.length > 0) {
      try {
        data = this.bytesToString(pako.inflateRaw(data));
      } catch (e) {
        console.error(e);
        return;
      }
    }

    if (encode) {
      try {
        data = decodeURIComponent(data);
      } catch (e) {
        console.error(e);
        return;
      }
    }

    return data;
  },

  parseXml(xml) {
    if (window.DOMParser) {
      const parser = new DOMParser();

      return parser.parseFromString(xml, 'text/xml');
    }
    const result = this.createXmlDocument();
    result.async = 'false';
    result.loadXML(xml);
    return result;
  },

  createXmlDocument() {
    let doc = null;

    if (document.implementation && document.implementation.createDocument) {
      doc = document.implementation.createDocument('', '', null);
    } else if (window.ActiveXObject) {
      doc = new ActiveXObject('Microsoft.XMLDOM');
    }

    return doc;
  },

  decodeFromUri(data) {
    try {
      data = decodeURIComponent(data);
    } catch (e) {
      console.error(e);
      return;
    }
    return data;
  },

  getTextContent(node) {
    return node != null ? node[node.textContent === undefined ? 'text' : 'textContent'] : '';
  },

  normalizeXml(data) {
    try {
      let str = data;
      str = str.replace(/>\s*/g, '>'); // Replace "> " with ">"
      str = str.replace(/\s*</g, '<'); // Replace "< " with "<"
      return data;
    } catch (e) {
      return;
    }
  },

  // sleep time expects milliseconds
  sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  },

  uniqueID() {
    function chr4() {
      return Math.random()
        .toString(16)
        .slice(-4);
    }
    return `${chr4() + chr4()}-${chr4()}-${chr4()}-${chr4()}-${chr4()}${chr4()}${chr4()}`;
  },

  stringToJsRegex(str) {
    if (str[0] !== '/') {
      return new RegExp(`^${str}$`);
    }
    const match = str.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));
    return new RegExp(match[1], match[2]);
  },

  matchString(str, pattern) {
    if (str === undefined || pattern === undefined || str.length === 0 || pattern.length === 0) {
      // u.log(0, `Match str=${str} pattern=${pattern}`, false);
      return false;
    }
    if (str === pattern) return true;
    const regex = this.stringToJsRegex(pattern);
    const matching = str.toString().match(regex);
    if (matching) {
      // u.log(0, `Match str=${str} pattern=${pattern}`, true);
      return true;
    }
    return false;
  },

  minify(text) {
    try {
      return vkbeautify.xmlmin(text, false);
    } catch (error) {
      this.log(3, 'Error in minify', error);
      return text;
    }
  },

  prettify(text) {
    try {
      return vkbeautify.xml(text);
    } catch (error) {
      this.log(3, 'Error in prettify', error);
      return text;
    }
  },

  prettifyJSON(text) {
    try {
      return vkbeautify.json(text);
    } catch (error) {
      this.log(3, 'Error in prettify', error);
      return text;
    }
  },

  log(level, title, obj) {
    // 0 : DEBUG
    // 1 : INFO
    // 2 : WARN
    // 3 : ERROR
    // eslint-disable-next-line no-undef
    if (GF_PLUGIN.logDisplay !== undefined && GF_PLUGIN.logDisplay === true) {
      // eslint-disable-next-line no-undef
      if (GF_PLUGIN.logLevel !== undefined && level >= GF_PLUGIN.logLevel) {
        if (level === 0) {
          console.debug(`DEBUG : ${title}`, obj);
          return;
        }
        if (level === 1) {
          console.info(` INFO : ${title}`, obj);
          return;
        }
        if (level === 2) {
          console.warn(` WARN : ${title}`, obj);
          return;
        }
        if (level === 3) {
          console.error(`ERROR : ${title}`, obj);
        }
      }
    }
  }
};
