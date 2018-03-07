/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

const
  PRIVATE_PROPERTIES = {
    type: Symbol('type'),
    value: Symbol('value'),
    token: Symbol('token'),
    residuals: Symbol('residuals')
  },
  NULL_TOKEN_TYPE = 'NULL';

class Token {

  constructor(type, value) {
    this[PRIVATE_PROPERTIES.type] = type;
    this[PRIVATE_PROPERTIES.value] = value;
  }

  get type() {
    return this[PRIVATE_PROPERTIES.type];
  }

  get value() {
    return this[PRIVATE_PROPERTIES.value];
  }

  isNull() {
    return (this.type === NULL_TOKEN_TYPE);
  }

  removeNulls() {
    this[PRIVATE_PROPERTIES.value] = [].concat(this.value).filter(token => (token != null) && (!token.isNull()));
  }

  static getToken(type, value) {
    return new Token(type, value);
  }

  static getNullToken() {
    return Token.getToken(NULL_TOKEN_TYPE, null);
  }

}

class ReadResult {

  constructor(token, residuals) {
    this[PRIVATE_PROPERTIES.token] = token;
    this[PRIVATE_PROPERTIES.residuals] = residuals;
  }

  get token() {
    return this[PRIVATE_PROPERTIES.token];
  }

  get residuals() {
    return this[PRIVATE_PROPERTIES.residuals];
  }

  aggregateSubTokensValues(withNullTokens = false) {
    let aggregatedValue;

    if (this.token != null) {
      aggregatedValue = ([].concat(this.token.value)).reduce((aggregation, subToken) => {
        if (withNullTokens || (!subToken.isNull())) {
          aggregation.push(...([].concat(subToken.value)));
        }
        return aggregation;
      }, []);
      this[PRIVATE_PROPERTIES.token] = Token.getToken(this.token.type, aggregatedValue);
    }
  }

  mergeResult(result, residuals) {
    let mergedValues;
    if ((this.token != null) && (result != null) && (result.token != null)) {
      mergedValues = [].concat(this.token.value).concat(result.token.value);
      this[PRIVATE_PROPERTIES.token] = Token.getToken(this.token.type, mergedValues);
      this[PRIVATE_PROPERTIES.residuals] = (residuals != null) ? residuals : result.residuals;
    }
  }

  static getReadResultWithToken(token, residuals) {
    return new ReadResult(token, residuals);
  }

  static getNullReadResult(residuals) {
    return new ReadResult(Token.getNullToken(), residuals);
  }

  static getReadResult(tokenType, tokenValues, residuals) {
    return new ReadResult(Token.getToken(tokenType, tokenValues), residuals);
  }

  static getReadResultFromTokenRegExp(tokenType, tokenRegExpResult) {
    if ((tokenRegExpResult != null) && (tokenRegExpResult.length >= 3)) {
      return this.getReadResult(tokenType, tokenRegExpResult[1], tokenRegExpResult[2]);
    }
    return null;
  }

}

class GenericTokenReaders {

  static readToken(tokenType, pattern, input) {
    const regExpResult = (input || '').match(new RegExp(`^${pattern}(.*)$`, 'i'));
    return ReadResult.getReadResultFromTokenRegExp(tokenType, regExpResult);
  }

  static readSelectorToken(tokenType, selectorName, input) {
    const
      selectorParametersPattern = '(?:(?:\\\\\\(|\\\\\\))|[^()])+',
      selectorPattern = `(?:${selectorName})\\((${selectorParametersPattern})\\)`;
    return this.readToken(tokenType, selectorPattern, input);
  }

  static readRepetitiveToken(tokenType, tokenReader, input) {
    let currentResult = tokenReader(input);
    const result = currentResult;

    while (currentResult != null) {
      currentResult = tokenReader(currentResult.residuals);
      result.mergeResult(currentResult);
    }

    return (result != null) ? ReadResult.getReadResult(tokenType, result.token.value, result.residuals) : null;
  }

  static readTokens(tokenType, tokenReadersIterator, input) {
    const readedTokens = [];
    let
      iterationOK,
      residuals = input;

    iterationOK = tokenReadersIterator((tokenReader) => {       // eslint-disable-line prefer-const
      const result = tokenReader(residuals);
      if (result != null) {
        readedTokens.push(result.token);
        residuals = result.residuals;
        return true;
      }
      return false;
    });

    return (iterationOK) ? ReadResult.getReadResult(tokenType, readedTokens, residuals) : null;
  }

  static readTokenSequence(tokenType, tokenReaders, input) {

    function sequenceIterator(anonymousCallback) {
      return tokenReaders.every(anonymousCallback);
    }

    return this.readTokens(tokenType, sequenceIterator, input);
  }

  static readFirstOccurredToken(tokenType, tokenReaders, input) {

    function firstOccurredIterator(anonymousCallback) {
      return tokenReaders.some(anonymousCallback);
    }

    return this.readTokens(tokenType, firstOccurredIterator, input);
  }

  static readTokensIfOccur(tokenType, tokenReaders, input) {

    function ifOccurIterator(anonymousCallback) {
      let iteratorResult = false;

      tokenReaders.forEach((reader, index, array) => {
        const result = anonymousCallback(reader, index, array);
        if (result) {
          iteratorResult = true;
        }
      });

      return iteratorResult;
    }

    return this.readTokens(tokenType, ifOccurIterator, input);
  }

  static readNullToken(input) {
    return ReadResult.getNullReadResult(input);
  }

}

class QueryTokenReaders {

  static readNodes(input) {
    return GenericTokenReaders.readToken('nodes', '(nodes)', input);
  }

  static readMonitoringPacks(input) {
    return GenericTokenReaders.readToken('monitoringPacks', '\\.(monitoringPacks)', input);
  }

  static readSelectorWithStringParameter(tokenType, selectorName, input) {
    const
      parameterCharPattern = '(?:[\\w~`!@#$%^&*_+-=\\[\\]{};\':<>,\\.\\?\\/|]|\\\\"|\\\\\\(|\\\\\\)|\\\\)',
      parameterPattern = `"(\\s*${parameterCharPattern}+(?:[\\s]${parameterCharPattern}+)*\\s*)"`,
      selectorReadResult = GenericTokenReaders.readSelectorToken('', selectorName, input);
    let
      parameterReadResult,
      parameterValue;

    function replaceHashedChars(string) {
      let result;

      result = (string || '').replace(/\\\(/g, '(');
      result = result.replace(/\\\)/g, ')');
      result = result.replace(/\\"/g, '"');
      return result;
    }

    if (selectorReadResult != null) {
      parameterReadResult = GenericTokenReaders.readToken('', parameterPattern, selectorReadResult.token.value);
      parameterValue = replaceHashedChars(parameterReadResult.token.value);
    }

    if ((selectorReadResult != null) && (parameterReadResult != null)) {
      return ReadResult.getReadResult(tokenType, parameterValue, selectorReadResult.residuals);
    }

    return null;
  }

  static readDot(input) {
    return GenericTokenReaders.readToken('dot', '(\\.)', input);
  }

  static readDotSelectorWithStringParameter(tokenType, selectorName, input) {
    const
      selectorReader = (readerInput => this.readSelectorWithStringParameter('', selectorName, readerInput)),
      readResult = GenericTokenReaders.readTokenSequence('', [this.readDot, selectorReader], input);

    if (readResult != null) {
      readResult.aggregateSubTokensValues();
      return ReadResult.getReadResult(tokenType, readResult.token.value[1], readResult.residuals);
    }
    return null;
  }

  static readNetworkAtlas(input) {
    return QueryTokenReaders.readDotSelectorWithStringParameter('networkAtlas', 'networkAtlas', input);
  }

  static readFolder(input) {
    return QueryTokenReaders.readDotSelectorWithStringParameter('folder', 'folder', input);
  }

  static readRepetitiveFolder(input) {
    const result = GenericTokenReaders.readRepetitiveToken('folders', QueryTokenReaders.readFolder, input);
    return result;
  }

  static readView(input) {
    return QueryTokenReaders.readDotSelectorWithStringParameter('view', 'view', input);
  }

  static readName(input) {
    return QueryTokenReaders.readDotSelectorWithStringParameter('name', 'name', input);
  }

  static readDeviceType(input) {
    const deviceTypes = 'windows\\.server|windows\\.workstation|windows|linux|bsd|macos|solaris|esx|xenserver' +
                        '|unix|novell|ibm';
    return GenericTokenReaders.readToken('deviceType', `\\.(${deviceTypes})`, input);
  }

}

class QueryParser {

  /*
    Query grammar:
      <networkFolderView> ::= ['.repetitiveFolder'][.view]'nothing'
      <networkMap> ::= '.networkAtlas'['networkFolderView']
      <monitoringPack> ::= '.monitoringPacks''.repetitiveFolder''.name'
      <networkMapOrMonitoringPack> ::= <networkMap>|<monitoringPack>
      <query> ::= 'nodes'[<networkMapOrMonitoringPack>]['.deviceType']
  */

  static parse(query) {
    const
      atoms = {
        'nodes': QueryTokenReaders.readNodes,                         // eslint-disable-line quote-props
        '.monitoringPacks': QueryTokenReaders.readMonitoringPacks,
        '.networkAtlas': QueryTokenReaders.readNetworkAtlas,
        '.repetitiveFolder': QueryTokenReaders.readRepetitiveFolder,
        '.view': QueryTokenReaders.readView,
        '.name': QueryTokenReaders.readName,
        '.deviceType': QueryTokenReaders.readDeviceType,
        'nothing': GenericTokenReaders.readNullToken                  // eslint-disable-line quote-props
      },
      queryGrammar = {

        networkFoldersView: (input) => {
          const
            foldersView = [atoms['.repetitiveFolder'], atoms['.view'], atoms.nothing],
            result = GenericTokenReaders.readTokensIfOccur('networkFoldersView', foldersView, input);
          if (result != null) {
            result.aggregateSubTokensValues();
          }
          return result;
        },

        networkMap: (input) => {
          const
            networkMap = [atoms['.networkAtlas'], queryGrammar.networkFoldersView],
            result = GenericTokenReaders.readTokenSequence('networkMap', networkMap, input);

          if (result != null) {
            result.aggregateSubTokensValues();
          }
          return result;
        },

        monitoringPack: (input) => {
          const
            monitoringPack = [atoms['.monitoringPacks'], atoms['.repetitiveFolder'], atoms['.name']],
            result = GenericTokenReaders.readTokenSequence('monitoringPack', monitoringPack, input);

          if (result != null) {
            result.aggregateSubTokensValues();
          }
          return result;
        },

        networkMapOrMonitoringPack: (input) => {
          const
            mapOrMonitoringPack = [queryGrammar.networkMap, queryGrammar.monitoringPack, atoms.nothing],
            result = GenericTokenReaders.readFirstOccurredToken('', mapOrMonitoringPack, input);
          if (result != null) {
            return ReadResult.getReadResultWithToken(result.token.value[0], result.residuals);
          }
          return null;
        },

        query: (input) => {
          const parameters = [queryGrammar.networkMapOrMonitoringPack, atoms['.deviceType'], atoms.nothing];
          let
            result = atoms.nodes(input),
            parametersResult;

          if (result != null) {
            result = ReadResult.getReadResult('query', [result.token], result.residuals);
            parametersResult = GenericTokenReaders.readTokensIfOccur('', parameters, result.residuals);
            result.mergeResult(parametersResult);
            result.token.removeNulls();
          }
          return result;
        }

      };

    return queryGrammar.query(query);
  }

}

export {
  QueryParser
};
