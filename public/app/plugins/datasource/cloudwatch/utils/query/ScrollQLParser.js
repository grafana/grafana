// Generated from ScrollQLParser.g4 by ANTLR 4.8
/* eslint-disable */
// jshint ignore: start
// @ts-nocheck
var antlr4 = require('antlr4/index');
var ScrollQLParserListener = require('./ScrollQLParserListener').ScrollQLParserListener;
var grammarFileName = 'ScrollQLParser.g4';

var serializedATN = [
  '\u0003\u608b\ua72a\u8133\ub9ed\u417c\u3be7\u7786\u5964',
  '\u0003r\u0244\u0004\u0002\t\u0002\u0004\u0003\t\u0003\u0004\u0004\t',
  '\u0004\u0004\u0005\t\u0005\u0004\u0006\t\u0006\u0004\u0007\t\u0007\u0004',
  '\b\t\b\u0004\t\t\t\u0004\n\t\n\u0004\u000b\t\u000b\u0004\f\t\f\u0004',
  '\r\t\r\u0004\u000e\t\u000e\u0004\u000f\t\u000f\u0004\u0010\t\u0010\u0004',
  '\u0011\t\u0011\u0004\u0012\t\u0012\u0004\u0013\t\u0013\u0004\u0014\t',
  '\u0014\u0004\u0015\t\u0015\u0004\u0016\t\u0016\u0004\u0017\t\u0017\u0004',
  '\u0018\t\u0018\u0004\u0019\t\u0019\u0004\u001a\t\u001a\u0004\u001b\t',
  '\u001b\u0004\u001c\t\u001c\u0004\u001d\t\u001d\u0004\u001e\t\u001e\u0004',
  '\u001f\t\u001f\u0004 \t \u0004!\t!\u0004"\t"\u0004#\t#\u0004$\t$\u0004',
  "%\t%\u0004&\t&\u0004'\t'\u0004(\t(\u0004)\t)\u0004*\t*\u0004+\t+\u0004",
  ',\t,\u0004-\t-\u0004.\t.\u0004/\t/\u00040\t0\u00041\t1\u00042\t2\u0004',
  '3\t3\u00044\t4\u00045\t5\u00046\t6\u00047\t7\u00048\t8\u00049\t9\u0004',
  ':\t:\u0003\u0002\u0003\u0002\u0003\u0002\u0003\u0003\u0003\u0003\u0003',
  '\u0003\u0005\u0003{\n\u0003\u0003\u0003\u0003\u0003\u0005\u0003\u007f',
  '\n\u0003\u0003\u0004\u0003\u0004\u0003\u0004\u0007\u0004\u0084\n\u0004',
  '\f\u0004\u000e\u0004\u0087\u000b\u0004\u0003\u0005\u0003\u0005\u0003',
  '\u0005\u0007\u0005\u008c\n\u0005\f\u0005\u000e\u0005\u008f\u000b\u0005',
  '\u0003\u0005\u0003\u0005\u0005\u0005\u0093\n\u0005\u0003\u0005\u0003',
  '\u0005\u0007\u0005\u0097\n\u0005\f\u0005\u000e\u0005\u009a\u000b\u0005',
  '\u0003\u0006\u0003\u0006\u0003\u0006\u0007\u0006\u009f\n\u0006\f\u0006',
  '\u000e\u0006\u00a2\u000b\u0006\u0003\u0007\u0003\u0007\u0003\u0007\u0003',
  '\u0007\u0003\u0007\u0003\u0007\u0005\u0007\u00aa\n\u0007\u0003\b\u0003',
  '\b\u0003\b\u0003\b\u0003\b\u0005\b\u00b1\n\b\u0007\b\u00b3\n\b\f\b\u000e',
  '\b\u00b6\u000b\b\u0003\t\u0003\t\u0003\t\u0003\t\u0003\t\u0003\t\u0003',
  '\t\u0003\t\u0003\t\u0003\n\u0003\n\u0003\n\u0003\n\u0005\n\u00c5\n\n',
  '\u0003\u000b\u0003\u000b\u0003\f\u0003\f\u0005\f\u00cb\n\f\u0003\f\u0003',
  '\f\u0005\f\u00cf\n\f\u0003\f\u0005\f\u00d2\n\f\u0003\f\u0005\f\u00d5',
  '\n\f\u0003\r\u0003\r\u0005\r\u00d9\n\r\u0003\u000e\u0003\u000e\u0003',
  '\u000f\u0007\u000f\u00de\n\u000f\f\u000f\u000e\u000f\u00e1\u000b\u000f',
  '\u0003\u0010\u0003\u0010\u0003\u0010\u0003\u0010\u0007\u0010\u00e7\n',
  '\u0010\f\u0010\u000e\u0010\u00ea\u000b\u0010\u0003\u0010\u0005\u0010',
  '\u00ed\n\u0010\u0003\u0010\u0003\u0010\u0003\u0010\u0003\u0010\u0007',
  '\u0010\u00f3\n\u0010\f\u0010\u000e\u0010\u00f6\u000b\u0010\u0005\u0010',
  '\u00f8\n\u0010\u0003\u0011\u0003\u0011\u0003\u0011\u0005\u0011\u00fd',
  '\n\u0011\u0003\u0012\u0003\u0012\u0005\u0012\u0101\n\u0012\u0003\u0013',
  '\u0003\u0013\u0003\u0013\u0003\u0013\u0007\u0013\u0107\n\u0013\f\u0013',
  '\u000e\u0013\u010a\u000b\u0013\u0003\u0013\u0003\u0013\u0003\u0013\u0003',
  '\u0013\u0007\u0013\u0110\n\u0013\f\u0013\u000e\u0013\u0113\u000b\u0013',
  '\u0005\u0013\u0115\n\u0013\u0003\u0014\u0003\u0014\u0003\u0014\u0005',
  '\u0014\u011a\n\u0014\u0003\u0015\u0003\u0015\u0005\u0015\u011e\n\u0015',
  '\u0003\u0015\u0003\u0015\u0003\u0015\u0003\u0015\u0003\u0015\u0007\u0015',
  '\u0125\n\u0015\f\u0015\u000e\u0015\u0128\u000b\u0015\u0003\u0015\u0003',
  '\u0015\u0005\u0015\u012c\n\u0015\u0003\u0015\u0005\u0015\u012f\n\u0015',
  '\u0003\u0016\u0003\u0016\u0003\u0016\u0003\u0017\u0005\u0017\u0135\n',
  '\u0017\u0003\u0017\u0003\u0017\u0003\u0018\u0003\u0018\u0003\u0018\u0003',
  '\u0018\u0003\u0018\u0003\u0018\u0003\u0018\u0003\u0018\u0005\u0018\u0141',
  '\n\u0018\u0003\u0018\u0003\u0018\u0005\u0018\u0145\n\u0018\u0003\u0018',
  '\u0003\u0018\u0003\u0018\u0003\u0018\u0007\u0018\u014b\n\u0018\f\u0018',
  '\u000e\u0018\u014e\u000b\u0018\u0003\u0019\u0003\u0019\u0003\u0019\u0003',
  '\u0019\u0003\u0019\u0005\u0019\u0155\n\u0019\u0003\u001a\u0003\u001a',
  '\u0003\u001a\u0003\u001b\u0003\u001b\u0005\u001b\u015c\n\u001b\u0003',
  '\u001b\u0003\u001b\u0003\u001b\u0007\u001b\u0161\n\u001b\f\u001b\u000e',
  '\u001b\u0164\u000b\u001b\u0003\u001c\u0003\u001c\u0003\u001c\u0003\u001c',
  '\u0003\u001c\u0005\u001c\u016b\n\u001c\u0005\u001c\u016d\n\u001c\u0003',
  '\u001d\u0003\u001d\u0003\u001d\u0003\u001d\u0005\u001d\u0173\n\u001d',
  '\u0003\u001e\u0003\u001e\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f',
  '\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f',
  '\u0003\u001f\u0003\u001f\u0005\u001f\u0183\n\u001f\u0003\u001f\u0003',
  '\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003',
  '\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003',
  '\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0005\u001f\u0196\n\u001f',
  '\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0003\u001f',
  '\u0003\u001f\u0003\u001f\u0003\u001f\u0005\u001f\u01a1\n\u001f\u0003',
  '\u001f\u0003\u001f\u0003\u001f\u0003\u001f\u0005\u001f\u01a7\n\u001f',
  '\u0003\u001f\u0003\u001f\u0007\u001f\u01ab\n\u001f\f\u001f\u000e\u001f',
  '\u01ae\u000b\u001f\u0003 \u0003 \u0003 \u0003 \u0005 \u01b4\n \u0003',
  '!\u0003!\u0005!\u01b8\n!\u0003"\u0003"\u0003"\u0003"\u0003"\u0007',
  '"\u01bf\n"\f"\u000e"\u01c2\u000b"\u0003"\u0003"\u0003"\u0003',
  '"\u0003"\u0005"\u01c9\n"\u0003"\u0003"\u0005"\u01cd\n"\u0003',
  '#\u0003#\u0005#\u01d1\n#\u0003$\u0003$\u0003$\u0003$\u0007$\u01d7\n',
  '$\f$\u000e$\u01da\u000b$\u0003$\u0003$\u0003$\u0003$\u0005$\u01e0\n',
  '$\u0003%\u0003%\u0005%\u01e4\n%\u0003&\u0003&\u0005&\u01e8\n&\u0003',
  "'\u0003'\u0003'\u0003'\u0005'\u01ee\n'\u0003(\u0003(\u0003(\u0003",
  '(\u0003(\u0005(\u01f5\n(\u0003)\u0003)\u0003*\u0003*\u0003*\u0003*\u0005',
  '*\u01fd\n*\u0003+\u0003+\u0003+\u0003+\u0003+\u0003+\u0003+\u0005+\u0206',
  '\n+\u0003,\u0003,\u0005,\u020a\n,\u0003-\u0003-\u0005-\u020e\n-\u0003',
  '.\u0003.\u0005.\u0212\n.\u0003/\u0003/\u0005/\u0216\n/\u00030\u0003',
  '0\u00060\u021a\n0\r0\u000e0\u021b\u00030\u00030\u00031\u00031\u0003',
  '2\u00032\u00033\u00033\u00053\u0226\n3\u00034\u00034\u00034\u00035\u0003',
  '5\u00035\u00036\u00036\u00037\u00037\u00038\u00038\u00038\u00058\u0235',
  '\n8\u00039\u00039\u0003:\u0003:\u0003:\u0003:\u0003:\u0003:\u0003:\u0003',
  ':\u0003:\u0005:\u0242\n:\u0003:\u0002\u0004.<;\u0002\u0004\u0006\b\n',
  '\f\u000e\u0010\u0012\u0014\u0016\u0018\u001a\u001c\u001e "$&(*,.02',
  '468:<>@BDFHJLNPRTVXZ\\^`bdfhjlnpr\u0002\u001c\u0003\u0002;<\u0005\u0002',
  ':<JJQQ\u0003\u0002\u0010\u0011\u0003\u0002\u0014\u0015\u0004\u0002\u001e',
  '\u001eLL\u0003\u0002MO\u0003\u0002PQ\u0003\u0002SV\u0004\u0002\u001f',
  '\u001fBC\u0004\u0002==^^\u0004\u0002>>__\u0004\u0002??``\u0004\u0002',
  '@@aa\u0004\u0002DDcc\u0004\u0002AAdd\u0004\u0002::bb\u0003\u0002\u0005',
  " \u0003\u0002!#\u0003\u0002$&\u0003\u0002')\u0003\u0002*,\u0003\u0002",
  '-.\u0003\u0002/0\u0003\u000213\u0003\u000246\u0003\u000279\u0002\u027b',
  '\u0002t\u0003\u0002\u0002\u0002\u0004w\u0003\u0002\u0002\u0002\u0006',
  '\u0080\u0003\u0002\u0002\u0002\b\u0088\u0003\u0002\u0002\u0002\n\u009b',
  '\u0003\u0002\u0002\u0002\f\u00a9\u0003\u0002\u0002\u0002\u000e\u00ab',
  '\u0003\u0002\u0002\u0002\u0010\u00b7\u0003\u0002\u0002\u0002\u0012\u00c4',
  '\u0003\u0002\u0002\u0002\u0014\u00c6\u0003\u0002\u0002\u0002\u0016\u00d4',
  '\u0003\u0002\u0002\u0002\u0018\u00d8\u0003\u0002\u0002\u0002\u001a\u00da',
  '\u0003\u0002\u0002\u0002\u001c\u00df\u0003\u0002\u0002\u0002\u001e\u00e2',
  '\u0003\u0002\u0002\u0002 \u00f9\u0003\u0002\u0002\u0002"\u0100\u0003',
  '\u0002\u0002\u0002$\u0114\u0003\u0002\u0002\u0002&\u0116\u0003\u0002',
  '\u0002\u0002(\u012e\u0003\u0002\u0002\u0002*\u0130\u0003\u0002\u0002',
  '\u0002,\u0134\u0003\u0002\u0002\u0002.\u0140\u0003\u0002\u0002\u0002',
  '0\u0154\u0003\u0002\u0002\u00022\u0156\u0003\u0002\u0002\u00024\u0159',
  '\u0003\u0002\u0002\u00026\u016c\u0003\u0002\u0002\u00028\u0172\u0003',
  '\u0002\u0002\u0002:\u0174\u0003\u0002\u0002\u0002<\u0182\u0003\u0002',
  '\u0002\u0002>\u01b3\u0003\u0002\u0002\u0002@\u01b7\u0003\u0002\u0002',
  '\u0002B\u01cc\u0003\u0002\u0002\u0002D\u01d0\u0003\u0002\u0002\u0002',
  'F\u01df\u0003\u0002\u0002\u0002H\u01e3\u0003\u0002\u0002\u0002J\u01e7',
  '\u0003\u0002\u0002\u0002L\u01ed\u0003\u0002\u0002\u0002N\u01f4\u0003',
  '\u0002\u0002\u0002P\u01f6\u0003\u0002\u0002\u0002R\u01fc\u0003\u0002',
  '\u0002\u0002T\u0205\u0003\u0002\u0002\u0002V\u0209\u0003\u0002\u0002',
  '\u0002X\u020d\u0003\u0002\u0002\u0002Z\u0211\u0003\u0002\u0002\u0002',
  '\\\u0215\u0003\u0002\u0002\u0002^\u0217\u0003\u0002\u0002\u0002`\u021f',
  '\u0003\u0002\u0002\u0002b\u0221\u0003\u0002\u0002\u0002d\u0225\u0003',
  '\u0002\u0002\u0002f\u0227\u0003\u0002\u0002\u0002h\u022a\u0003\u0002',
  '\u0002\u0002j\u022d\u0003\u0002\u0002\u0002l\u022f\u0003\u0002\u0002',
  '\u0002n\u0234\u0003\u0002\u0002\u0002p\u0236\u0003\u0002\u0002\u0002',
  'r\u0241\u0003\u0002\u0002\u0002tu\u0005\u0004\u0003\u0002uv\u0007\u0002',
  '\u0002\u0003v\u0003\u0003\u0002\u0002\u0002wz\u0005\b\u0005\u0002xy',
  '\u0007H\u0002\u0002y{\u0005\n\u0006\u0002zx\u0003\u0002\u0002\u0002',
  'z{\u0003\u0002\u0002\u0002{~\u0003\u0002\u0002\u0002|}\u0007I\u0002',
  '\u0002}\u007f\u0005j6\u0002~|\u0003\u0002\u0002\u0002~\u007f\u0003\u0002',
  '\u0002\u0002\u007f\u0005\u0003\u0002\u0002\u0002\u0080\u0085\u0005j',
  '6\u0002\u0081\u0082\u0007H\u0002\u0002\u0082\u0084\u0005\u000e\b\u0002',
  '\u0083\u0081\u0003\u0002\u0002\u0002\u0084\u0087\u0003\u0002\u0002\u0002',
  '\u0085\u0083\u0003\u0002\u0002\u0002\u0085\u0086\u0003\u0002\u0002\u0002',
  '\u0086\u0007\u0003\u0002\u0002\u0002\u0087\u0085\u0003\u0002\u0002\u0002',
  '\u0088\u008d\u0005\u0010\t\u0002\u0089\u008a\u0007H\u0002\u0002\u008a',
  '\u008c\u0005\u0010\t\u0002\u008b\u0089\u0003\u0002\u0002\u0002\u008c',
  '\u008f\u0003\u0002\u0002\u0002\u008d\u008b\u0003\u0002\u0002\u0002\u008d',
  '\u008e\u0003\u0002\u0002\u0002\u008e\u0092\u0003\u0002\u0002\u0002\u008f',
  '\u008d\u0003\u0002\u0002\u0002\u0090\u0091\u0007H\u0002\u0002\u0091',
  '\u0093\u0005,\u0017\u0002\u0092\u0090\u0003\u0002\u0002\u0002\u0092',
  '\u0093\u0003\u0002\u0002\u0002\u0093\u0098\u0003\u0002\u0002\u0002\u0094',
  '\u0095\u0007H\u0002\u0002\u0095\u0097\u0005\f\u0007\u0002\u0096\u0094',
  '\u0003\u0002\u0002\u0002\u0097\u009a\u0003\u0002\u0002\u0002\u0098\u0096',
  '\u0003\u0002\u0002\u0002\u0098\u0099\u0003\u0002\u0002\u0002\u0099\t',
  '\u0003\u0002\u0002\u0002\u009a\u0098\u0003\u0002\u0002\u0002\u009b\u00a0',
  '\u0005\u001e\u0010\u0002\u009c\u009d\u0007H\u0002\u0002\u009d\u009f',
  '\u0005\f\u0007\u0002\u009e\u009c\u0003\u0002\u0002\u0002\u009f\u00a2',
  '\u0003\u0002\u0002\u0002\u00a0\u009e\u0003\u0002\u0002\u0002\u00a0\u00a1',
  '\u0003\u0002\u0002\u0002\u00a1\u000b\u0003\u0002\u0002\u0002\u00a2\u00a0',
  '\u0003\u0002\u0002\u0002\u00a3\u00aa\u0005$\u0013\u0002\u00a4\u00aa',
  '\u0005(\u0015\u0002\u00a5\u00aa\u00052\u001a\u0002\u00a6\u00aa\u0005',
  '*\u0016\u0002\u00a7\u00aa\u00054\u001b\u0002\u00a8\u00aa\u00058\u001d',
  '\u0002\u00a9\u00a3\u0003\u0002\u0002\u0002\u00a9\u00a4\u0003\u0002\u0002',
  '\u0002\u00a9\u00a5\u0003\u0002\u0002\u0002\u00a9\u00a6\u0003\u0002\u0002',
  '\u0002\u00a9\u00a7\u0003\u0002\u0002\u0002\u00a9\u00a8\u0003\u0002\u0002',
  '\u0002\u00aa\r\u0003\u0002\u0002\u0002\u00ab\u00b4\u0005l7\u0002\u00ac',
  '\u00ad\u0005n8\u0002\u00ad\u00ae\u0007W\u0002\u0002\u00ae\u00b0\u0005',
  'V,\u0002\u00af\u00b1\u0007E\u0002\u0002\u00b0\u00af\u0003\u0002\u0002',
  '\u0002\u00b0\u00b1\u0003\u0002\u0002\u0002\u00b1\u00b3\u0003\u0002\u0002',
  '\u0002\u00b2\u00ac\u0003\u0002\u0002\u0002\u00b3\u00b6\u0003\u0002\u0002',
  '\u0002\u00b4\u00b2\u0003\u0002\u0002\u0002\u00b4\u00b5\u0003\u0002\u0002',
  '\u0002\u00b5\u000f\u0003\u0002\u0002\u0002\u00b6\u00b4\u0003\u0002\u0002',
  '\u0002\u00b7\u00b8\u0007\u0005\u0002\u0002\u00b8\u00b9\u0005T+\u0002',
  '\u00b9\u00ba\u0007\u0006\u0002\u0002\u00ba\u00bb\u0007W\u0002\u0002',
  '\u00bb\u00bc\u0005\u0012\n\u0002\u00bc\u00bd\u0007\u0007\u0002\u0002',
  '\u00bd\u00be\u0007W\u0002\u0002\u00be\u00bf\u0005\u0012\n\u0002\u00bf',
  '\u0011\u0003\u0002\u0002\u0002\u00c0\u00c5\u0005\u0014\u000b\u0002\u00c1',
  '\u00c5\u0005\u0016\f\u0002\u00c2\u00c5\u0005\u001a\u000e\u0002\u00c3',
  '\u00c5\u0005\u0018\r\u0002\u00c4\u00c0\u0003\u0002\u0002\u0002\u00c4',
  '\u00c1\u0003\u0002\u0002\u0002\u00c4\u00c2\u0003\u0002\u0002\u0002\u00c4',
  '\u00c3\u0003\u0002\u0002\u0002\u00c5\u0013\u0003\u0002\u0002\u0002\u00c6',
  '\u00c7\u0007\b\u0002\u0002\u00c7\u0015\u0003\u0002\u0002\u0002\u00c8',
  '\u00ca\u0007Q\u0002\u0002\u00c9\u00cb\t\u0002\u0002\u0002\u00ca\u00c9',
  '\u0003\u0002\u0002\u0002\u00ca\u00cb\u0003\u0002\u0002\u0002\u00cb\u00cc',
  '\u0003\u0002\u0002\u0002\u00cc\u00d5\u0005r:\u0002\u00cd\u00cf\u0007',
  'P\u0002\u0002\u00ce\u00cd\u0003\u0002\u0002\u0002\u00ce\u00cf\u0003',
  '\u0002\u0002\u0002\u00cf\u00d1\u0003\u0002\u0002\u0002\u00d0\u00d2\t',
  '\u0002\u0002\u0002\u00d1\u00d0\u0003\u0002\u0002\u0002\u00d1\u00d2\u0003',
  '\u0002\u0002\u0002\u00d2\u00d3\u0003\u0002\u0002\u0002\u00d3\u00d5\u0005',
  'r:\u0002\u00d4\u00c8\u0003\u0002\u0002\u0002\u00d4\u00ce\u0003\u0002',
  '\u0002\u0002\u00d5\u0017\u0003\u0002\u0002\u0002\u00d6\u00d9\u0005N',
  '(\u0002\u00d7\u00d9\u0005\u001c\u000f\u0002\u00d8\u00d6\u0003\u0002',
  '\u0002\u0002\u00d8\u00d7\u0003\u0002\u0002\u0002\u00d9\u0019\u0003\u0002',
  '\u0002\u0002\u00da\u00db\t\u0002\u0002\u0002\u00db\u001b\u0003\u0002',
  '\u0002\u0002\u00dc\u00de\t\u0003\u0002\u0002\u00dd\u00dc\u0003\u0002',
  '\u0002\u0002\u00de\u00e1\u0003\u0002\u0002\u0002\u00df\u00dd\u0003\u0002',
  '\u0002\u0002\u00df\u00e0\u0003\u0002\u0002\u0002\u00e0\u001d\u0003\u0002',
  '\u0002\u0002\u00e1\u00df\u0003\u0002\u0002\u0002\u00e2\u00e3\u0007\u000f',
  '\u0002\u0002\u00e3\u00e8\u0005 \u0011\u0002\u00e4\u00e5\u0007E\u0002',
  '\u0002\u00e5\u00e7\u0005 \u0011\u0002\u00e6\u00e4\u0003\u0002\u0002',
  '\u0002\u00e7\u00ea\u0003\u0002\u0002\u0002\u00e8\u00e6\u0003\u0002\u0002',
  '\u0002\u00e8\u00e9\u0003\u0002\u0002\u0002\u00e9\u00f7\u0003\u0002\u0002',
  '\u0002\u00ea\u00e8\u0003\u0002\u0002\u0002\u00eb\u00ed\u0007\u0019\u0002',
  '\u0002\u00ec\u00eb\u0003\u0002\u0002\u0002\u00ec\u00ed\u0003\u0002\u0002',
  '\u0002\u00ed\u00ee\u0003\u0002\u0002\u0002\u00ee\u00ef\u0007\u001a\u0002',
  '\u0002\u00ef\u00f4\u0005"\u0012\u0002\u00f0\u00f1\u0007E\u0002\u0002',
  '\u00f1\u00f3\u0005"\u0012\u0002\u00f2\u00f0\u0003\u0002\u0002\u0002',
  '\u00f3\u00f6\u0003\u0002\u0002\u0002\u00f4\u00f2\u0003\u0002\u0002\u0002',
  '\u00f4\u00f5\u0003\u0002\u0002\u0002\u00f5\u00f8\u0003\u0002\u0002\u0002',
  '\u00f6\u00f4\u0003\u0002\u0002\u0002\u00f7\u00ec\u0003\u0002\u0002\u0002',
  '\u00f7\u00f8\u0003\u0002\u0002\u0002\u00f8\u001f\u0003\u0002\u0002\u0002',
  '\u00f9\u00fc\u0005:\u001e\u0002\u00fa\u00fb\u0007\u001b\u0002\u0002',
  '\u00fb\u00fd\u0005X-\u0002\u00fc\u00fa\u0003\u0002\u0002\u0002\u00fc',
  '\u00fd\u0003\u0002\u0002\u0002\u00fd!\u0003\u0002\u0002\u0002\u00fe',
  '\u0101\u0005V,\u0002\u00ff\u0101\u0005&\u0014\u0002\u0100\u00fe\u0003',
  '\u0002\u0002\u0002\u0100\u00ff\u0003\u0002\u0002\u0002\u0101#\u0003',
  '\u0002\u0002\u0002\u0102\u0103\u0007\f\u0002\u0002\u0103\u0108\u0005',
  '&\u0014\u0002\u0104\u0105\u0007E\u0002\u0002\u0105\u0107\u0005&\u0014',
  '\u0002\u0106\u0104\u0003\u0002\u0002\u0002\u0107\u010a\u0003\u0002\u0002',
  '\u0002\u0108\u0106\u0003\u0002\u0002\u0002\u0108\u0109\u0003\u0002\u0002',
  '\u0002\u0109\u0115\u0003\u0002\u0002\u0002\u010a\u0108\u0003\u0002\u0002',
  '\u0002\u010b\u010c\u0007\r\u0002\u0002\u010c\u0111\u0005&\u0014\u0002',
  '\u010d\u010e\u0007E\u0002\u0002\u010e\u0110\u0005&\u0014\u0002\u010f',
  '\u010d\u0003\u0002\u0002\u0002\u0110\u0113\u0003\u0002\u0002\u0002\u0111',
  '\u010f\u0003\u0002\u0002\u0002\u0111\u0112\u0003\u0002\u0002\u0002\u0112',
  '\u0115\u0003\u0002\u0002\u0002\u0113\u0111\u0003\u0002\u0002\u0002\u0114',
  '\u0102\u0003\u0002\u0002\u0002\u0114\u010b\u0003\u0002\u0002\u0002\u0115',
  '%\u0003\u0002\u0002\u0002\u0116\u0119\u0005:\u001e\u0002\u0117\u0118',
  '\u0007\u001b\u0002\u0002\u0118\u011a\u0005X-\u0002\u0119\u0117\u0003',
  "\u0002\u0002\u0002\u0119\u011a\u0003\u0002\u0002\u0002\u011a'\u0003",
  '\u0002\u0002\u0002\u011b\u011d\u0007\n\u0002\u0002\u011c\u011e\u0005',
  'V,\u0002\u011d\u011c\u0003\u0002\u0002\u0002\u011d\u011e\u0003\u0002',
  '\u0002\u0002\u011e\u011f\u0003\u0002\u0002\u0002\u011f\u0120\u0005L',
  "'\u0002\u0120\u0121\u0007\u001b\u0002\u0002\u0121\u0126\u0005X-\u0002",
  '\u0122\u0123\u0007E\u0002\u0002\u0123\u0125\u0005X-\u0002\u0124\u0122',
  '\u0003\u0002\u0002\u0002\u0125\u0128\u0003\u0002\u0002\u0002\u0126\u0124',
  '\u0003\u0002\u0002\u0002\u0126\u0127\u0003\u0002\u0002\u0002\u0127\u012f',
  '\u0003\u0002\u0002\u0002\u0128\u0126\u0003\u0002\u0002\u0002\u0129\u012b',
  '\u0007\n\u0002\u0002\u012a\u012c\u0005V,\u0002\u012b\u012a\u0003\u0002',
  '\u0002\u0002\u012b\u012c\u0003\u0002\u0002\u0002\u012c\u012d\u0003\u0002',
  '\u0002\u0002\u012d\u012f\u0005P)\u0002\u012e\u011b\u0003\u0002\u0002',
  '\u0002\u012e\u0129\u0003\u0002\u0002\u0002\u012f)\u0003\u0002\u0002',
  '\u0002\u0130\u0131\u0007\u000b\u0002\u0002\u0131\u0132\u0005.\u0018',
  '\u0002\u0132+\u0003\u0002\u0002\u0002\u0133\u0135\u0007g\u0002\u0002',
  '\u0134\u0133\u0003\u0002\u0002\u0002\u0134\u0135\u0003\u0002\u0002\u0002',
  '\u0135\u0136\u0003\u0002\u0002\u0002\u0136\u0137\u0005.\u0018\u0002',
  '\u0137-\u0003\u0002\u0002\u0002\u0138\u0139\b\u0018\u0001\u0002\u0139',
  '\u013a\u0007l\u0002\u0002\u013a\u0141\u0005.\u0018\u0007\u013b\u013c',
  '\u0007h\u0002\u0002\u013c\u013d\u0005.\u0018\u0002\u013d\u013e\u0007',
  'i\u0002\u0002\u013e\u0141\u0003\u0002\u0002\u0002\u013f\u0141\u0005',
  '0\u0019\u0002\u0140\u0138\u0003\u0002\u0002\u0002\u0140\u013b\u0003',
  '\u0002\u0002\u0002\u0140\u013f\u0003\u0002\u0002\u0002\u0141\u014c\u0003',
  '\u0002\u0002\u0002\u0142\u0144\f\u0005\u0002\u0002\u0143\u0145\u0007',
  'j\u0002\u0002\u0144\u0143\u0003\u0002\u0002\u0002\u0144\u0145\u0003',
  '\u0002\u0002\u0002\u0145\u0146\u0003\u0002\u0002\u0002\u0146\u014b\u0005',
  '.\u0018\u0006\u0147\u0148\f\u0004\u0002\u0002\u0148\u0149\u0007k\u0002',
  '\u0002\u0149\u014b\u0005.\u0018\u0005\u014a\u0142\u0003\u0002\u0002',
  '\u0002\u014a\u0147\u0003\u0002\u0002\u0002\u014b\u014e\u0003\u0002\u0002',
  '\u0002\u014c\u014a\u0003\u0002\u0002\u0002\u014c\u014d\u0003\u0002\u0002',
  '\u0002\u014d/\u0003\u0002\u0002\u0002\u014e\u014c\u0003\u0002\u0002',
  '\u0002\u014f\u0155\u0007q\u0002\u0002\u0150\u0155\u0007m\u0002\u0002',
  '\u0151\u0155\u0007n\u0002\u0002\u0152\u0155\u0007o\u0002\u0002\u0153',
  '\u0155\u0007p\u0002\u0002\u0154\u014f\u0003\u0002\u0002\u0002\u0154',
  '\u0150\u0003\u0002\u0002\u0002\u0154\u0151\u0003\u0002\u0002\u0002\u0154',
  '\u0152\u0003\u0002\u0002\u0002\u0154\u0153\u0003\u0002\u0002\u0002\u0155',
  '1\u0003\u0002\u0002\u0002\u0156\u0157\u0007\u000e\u0002\u0002\u0157',
  '\u0158\u0005:\u001e\u0002\u01583\u0003\u0002\u0002\u0002\u0159\u015b',
  '\t\u0004\u0002\u0002\u015a\u015c\u0007\u001a\u0002\u0002\u015b\u015a',
  '\u0003\u0002\u0002\u0002\u015b\u015c\u0003\u0002\u0002\u0002\u015c\u015d',
  '\u0003\u0002\u0002\u0002\u015d\u0162\u00056\u001c\u0002\u015e\u015f',
  '\u0007E\u0002\u0002\u015f\u0161\u00056\u001c\u0002\u0160\u015e\u0003',
  '\u0002\u0002\u0002\u0161\u0164\u0003\u0002\u0002\u0002\u0162\u0160\u0003',
  '\u0002\u0002\u0002\u0162\u0163\u0003\u0002\u0002\u0002\u01635\u0003',
  '\u0002\u0002\u0002\u0164\u0162\u0003\u0002\u0002\u0002\u0165\u0166\u0005',
  'V,\u0002\u0166\u0167\u0007\u0013\u0002\u0002\u0167\u016d\u0003\u0002',
  '\u0002\u0002\u0168\u016a\u0005V,\u0002\u0169\u016b\u0007\u0012\u0002',
  '\u0002\u016a\u0169\u0003\u0002\u0002\u0002\u016a\u016b\u0003\u0002\u0002',
  '\u0002\u016b\u016d\u0003\u0002\u0002\u0002\u016c\u0165\u0003\u0002\u0002',
  '\u0002\u016c\u0168\u0003\u0002\u0002\u0002\u016d7\u0003\u0002\u0002',
  '\u0002\u016e\u016f\t\u0005\u0002\u0002\u016f\u0173\u0007;\u0002\u0002',
  '\u0170\u0171\u0007\u0016\u0002\u0002\u0171\u0173\u0007;\u0002\u0002',
  '\u0172\u016e\u0003\u0002\u0002\u0002\u0172\u0170\u0003\u0002\u0002\u0002',
  '\u01739\u0003\u0002\u0002\u0002\u0174\u0175\u0005<\u001f\u0002\u0175',
  ';\u0003\u0002\u0002\u0002\u0176\u0177\b\u001f\u0001\u0002\u0177\u0178',
  '\u0007F\u0002\u0002\u0178\u0179\u0005<\u001f\u0002\u0179\u017a\u0007',
  'G\u0002\u0002\u017a\u0183\u0003\u0002\u0002\u0002\u017b\u017c\t\u0006',
  '\u0002\u0002\u017c\u0183\u0005<\u001f\u000e\u017d\u017e\u0007Q\u0002',
  '\u0002\u017e\u0183\u0005<\u001f\r\u017f\u0180\u0007P\u0002\u0002\u0180',
  '\u0183\u0005<\u001f\f\u0181\u0183\u0005> \u0002\u0182\u0176\u0003\u0002',
  '\u0002\u0002\u0182\u017b\u0003\u0002\u0002\u0002\u0182\u017d\u0003\u0002',
  '\u0002\u0002\u0182\u017f\u0003\u0002\u0002\u0002\u0182\u0181\u0003\u0002',
  '\u0002\u0002\u0183\u01ac\u0003\u0002\u0002\u0002\u0184\u0185\f\u000f',
  '\u0002\u0002\u0185\u0186\u0007K\u0002\u0002\u0186\u01ab\u0005<\u001f',
  '\u000f\u0187\u0188\f\u000b\u0002\u0002\u0188\u0189\t\u0007\u0002\u0002',
  '\u0189\u01ab\u0005<\u001f\f\u018a\u018b\f\n\u0002\u0002\u018b\u018c',
  '\t\b\u0002\u0002\u018c\u01ab\u0005<\u001f\u000b\u018d\u018e\f\t\u0002',
  '\u0002\u018e\u018f\t\t\u0002\u0002\u018f\u01ab\u0005<\u001f\n\u0190',
  '\u0195\f\b\u0002\u0002\u0191\u0192\u0007W\u0002\u0002\u0192\u0196\u0007',
  'W\u0002\u0002\u0193\u0196\u0007W\u0002\u0002\u0194\u0196\u0007X\u0002',
  '\u0002\u0195\u0191\u0003\u0002\u0002\u0002\u0195\u0193\u0003\u0002\u0002',
  '\u0002\u0195\u0194\u0003\u0002\u0002\u0002\u0196\u0197\u0003\u0002\u0002',
  '\u0002\u0197\u01ab\u0005<\u001f\t\u0198\u0199\f\u0005\u0002\u0002\u0199',
  '\u019a\u0007\u001c\u0002\u0002\u019a\u01ab\u0005<\u001f\u0006\u019b',
  '\u019c\f\u0004\u0002\u0002\u019c\u019d\u0007\u001d\u0002\u0002\u019d',
  '\u01ab\u0005<\u001f\u0005\u019e\u01a0\f\u0007\u0002\u0002\u019f\u01a1',
  '\u0007\u001e\u0002\u0002\u01a0\u019f\u0003\u0002\u0002\u0002\u01a0\u01a1',
  '\u0003\u0002\u0002\u0002\u01a1\u01a2\u0003\u0002\u0002\u0002\u01a2\u01a3',
  '\t\n\u0002\u0002\u01a3\u01ab\u0005@!\u0002\u01a4\u01a6\f\u0006\u0002',
  '\u0002\u01a5\u01a7\u0007\u001e\u0002\u0002\u01a6\u01a5\u0003\u0002\u0002',
  '\u0002\u01a6\u01a7\u0003\u0002\u0002\u0002\u01a7\u01a8\u0003\u0002\u0002',
  '\u0002\u01a8\u01a9\u0007\u0018\u0002\u0002\u01a9\u01ab\u0005F$\u0002',
  '\u01aa\u0184\u0003\u0002\u0002\u0002\u01aa\u0187\u0003\u0002\u0002\u0002',
  '\u01aa\u018a\u0003\u0002\u0002\u0002\u01aa\u018d\u0003\u0002\u0002\u0002',
  '\u01aa\u0190\u0003\u0002\u0002\u0002\u01aa\u0198\u0003\u0002\u0002\u0002',
  '\u01aa\u019b\u0003\u0002\u0002\u0002\u01aa\u019e\u0003\u0002\u0002\u0002',
  '\u01aa\u01a4\u0003\u0002\u0002\u0002\u01ab\u01ae\u0003\u0002\u0002\u0002',
  '\u01ac\u01aa\u0003\u0002\u0002\u0002\u01ac\u01ad\u0003\u0002\u0002\u0002',
  '\u01ad=\u0003\u0002\u0002\u0002\u01ae\u01ac\u0003\u0002\u0002\u0002',
  '\u01af\u01b4\u0005V,\u0002\u01b0\u01b4\u0005J&\u0002\u01b1\u01b4\u0005',
  'N(\u0002\u01b2\u01b4\u0005B"\u0002\u01b3\u01af\u0003\u0002\u0002\u0002',
  '\u01b3\u01b0\u0003\u0002\u0002\u0002\u01b3\u01b1\u0003\u0002\u0002\u0002',
  '\u01b3\u01b2\u0003\u0002\u0002\u0002\u01b4?\u0003\u0002\u0002\u0002',
  '\u01b5\u01b8\u0005P)\u0002\u01b6\u01b8\u0005R*\u0002\u01b7\u01b5\u0003',
  '\u0002\u0002\u0002\u01b7\u01b6\u0003\u0002\u0002\u0002\u01b8A\u0003',
  '\u0002\u0002\u0002\u01b9\u01ba\u0005l7\u0002\u01ba\u01bb\u0007F\u0002',
  '\u0002\u01bb\u01c0\u0005D#\u0002\u01bc\u01bd\u0007E\u0002\u0002\u01bd',
  '\u01bf\u0005D#\u0002\u01be\u01bc\u0003\u0002\u0002\u0002\u01bf\u01c2',
  '\u0003\u0002\u0002\u0002\u01c0\u01be\u0003\u0002\u0002\u0002\u01c0\u01c1',
  '\u0003\u0002\u0002\u0002\u01c1\u01c3\u0003\u0002\u0002\u0002\u01c2\u01c0',
  '\u0003\u0002\u0002\u0002\u01c3\u01c4\u0007G\u0002\u0002\u01c4\u01cd',
  '\u0003\u0002\u0002\u0002\u01c5\u01c6\u0005l7\u0002\u01c6\u01c8\u0007',
  'F\u0002\u0002\u01c7\u01c9\u0007M\u0002\u0002\u01c8\u01c7\u0003\u0002',
  '\u0002\u0002\u01c8\u01c9\u0003\u0002\u0002\u0002\u01c9\u01ca\u0003\u0002',
  '\u0002\u0002\u01ca\u01cb\u0007G\u0002\u0002\u01cb\u01cd\u0003\u0002',
  '\u0002\u0002\u01cc\u01b9\u0003\u0002\u0002\u0002\u01cc\u01c5\u0003\u0002',
  '\u0002\u0002\u01cdC\u0003\u0002\u0002\u0002\u01ce\u01d1\u0005\u0016',
  '\f\u0002\u01cf\u01d1\u0005<\u001f\u0002\u01d0\u01ce\u0003\u0002\u0002',
  '\u0002\u01d0\u01cf\u0003\u0002\u0002\u0002\u01d1E\u0003\u0002\u0002',
  '\u0002\u01d2\u01d3\u0007Y\u0002\u0002\u01d3\u01d8\u0005H%\u0002\u01d4',
  '\u01d5\u0007E\u0002\u0002\u01d5\u01d7\u0005H%\u0002\u01d6\u01d4\u0003',
  '\u0002\u0002\u0002\u01d7\u01da\u0003\u0002\u0002\u0002\u01d8\u01d6\u0003',
  '\u0002\u0002\u0002\u01d8\u01d9\u0003\u0002\u0002\u0002\u01d9\u01db\u0003',
  '\u0002\u0002\u0002\u01da\u01d8\u0003\u0002\u0002\u0002\u01db\u01dc\u0007',
  'Z\u0002\u0002\u01dc\u01e0\u0003\u0002\u0002\u0002\u01dd\u01de\u0007',
  'Y\u0002\u0002\u01de\u01e0\u0007Z\u0002\u0002\u01df\u01d2\u0003\u0002',
  '\u0002\u0002\u01df\u01dd\u0003\u0002\u0002\u0002\u01e0G\u0003\u0002',
  "\u0002\u0002\u01e1\u01e4\u0005L'\u0002\u01e2\u01e4\u0005J&\u0002\u01e3",
  '\u01e1\u0003\u0002\u0002\u0002\u01e3\u01e2\u0003\u0002\u0002\u0002\u01e4',
  'I\u0003\u0002\u0002\u0002\u01e5\u01e8\u0007<\u0002\u0002\u01e6\u01e8',
  '\u0007;\u0002\u0002\u01e7\u01e5\u0003\u0002\u0002\u0002\u01e7\u01e6',
  '\u0003\u0002\u0002\u0002\u01e8K\u0003\u0002\u0002\u0002\u01e9\u01ee',
  '\t\u000b\u0002\u0002\u01ea\u01ee\t\f\u0002\u0002\u01eb\u01ee\t\r\u0002',
  '\u0002\u01ec\u01ee\t\u000e\u0002\u0002\u01ed\u01e9\u0003\u0002\u0002',
  '\u0002\u01ed\u01ea\u0003\u0002\u0002\u0002\u01ed\u01eb\u0003\u0002\u0002',
  '\u0002\u01ed\u01ec\u0003\u0002\u0002\u0002\u01eeM\u0003\u0002\u0002',
  '\u0002\u01ef\u01f5\t\u000b\u0002\u0002\u01f0\u01f5\t\f\u0002\u0002\u01f1',
  '\u01f5\t\r\u0002\u0002\u01f2\u01f5\t\u000e\u0002\u0002\u01f3\u01f5\u0007',
  ':\u0002\u0002\u01f4\u01ef\u0003\u0002\u0002\u0002\u01f4\u01f0\u0003',
  '\u0002\u0002\u0002\u01f4\u01f1\u0003\u0002\u0002\u0002\u01f4\u01f2\u0003',
  '\u0002\u0002\u0002\u01f4\u01f3\u0003\u0002\u0002\u0002\u01f5O\u0003',
  '\u0002\u0002\u0002\u01f6\u01f7\u0007]\u0002\u0002\u01f7Q\u0003\u0002',
  '\u0002\u0002\u01f8\u01fd\u0007^\u0002\u0002\u01f9\u01fd\u0007_\u0002',
  '\u0002\u01fa\u01fd\u0007`\u0002\u0002\u01fb\u01fd\u0007a\u0002\u0002',
  '\u01fc\u01f8\u0003\u0002\u0002\u0002\u01fc\u01f9\u0003\u0002\u0002\u0002',
  '\u01fc\u01fa\u0003\u0002\u0002\u0002\u01fc\u01fb\u0003\u0002\u0002\u0002',
  '\u01fdS\u0003\u0002\u0002\u0002\u01fe\u0206\u0007:\u0002\u0002\u01ff',
  '\u0206\u0005p9\u0002\u0200\u0206\u0005r:\u0002\u0201\u0206\t\u000b\u0002',
  '\u0002\u0202\u0206\t\f\u0002\u0002\u0203\u0206\t\r\u0002\u0002\u0204',
  '\u0206\t\u000e\u0002\u0002\u0205\u01fe\u0003\u0002\u0002\u0002\u0205',
  '\u01ff\u0003\u0002\u0002\u0002\u0205\u0200\u0003\u0002\u0002\u0002\u0205',
  '\u0201\u0003\u0002\u0002\u0002\u0205\u0202\u0003\u0002\u0002\u0002\u0205',
  '\u0203\u0003\u0002\u0002\u0002\u0205\u0204\u0003\u0002\u0002\u0002\u0206',
  'U\u0003\u0002\u0002\u0002\u0207\u020a\u0005Z.\u0002\u0208\u020a\u0005',
  'd3\u0002\u0209\u0207\u0003\u0002\u0002\u0002\u0209\u0208\u0003\u0002',
  '\u0002\u0002\u020aW\u0003\u0002\u0002\u0002\u020b\u020e\u0005Z.\u0002',
  '\u020c\u020e\u0005d3\u0002\u020d\u020b\u0003\u0002\u0002\u0002\u020d',
  '\u020c\u0003\u0002\u0002\u0002\u020eY\u0003\u0002\u0002\u0002\u020f',
  '\u0212\u0005\\/\u0002\u0210\u0212\u0005b2\u0002\u0211\u020f\u0003\u0002',
  '\u0002\u0002\u0211\u0210\u0003\u0002\u0002\u0002\u0212[\u0003\u0002',
  '\u0002\u0002\u0213\u0216\u0005`1\u0002\u0214\u0216\u0005^0\u0002\u0215',
  '\u0213\u0003\u0002\u0002\u0002\u0215\u0214\u0003\u0002\u0002\u0002\u0216',
  ']\u0003\u0002\u0002\u0002\u0217\u0219\t\u000f\u0002\u0002\u0218\u021a',
  '\t\u000f\u0002\u0002\u0219\u0218\u0003\u0002\u0002\u0002\u021a\u021b',
  '\u0003\u0002\u0002\u0002\u021b\u0219\u0003\u0002\u0002\u0002\u021b\u021c',
  '\u0003\u0002\u0002\u0002\u021c\u021d\u0003\u0002\u0002\u0002\u021d\u021e',
  '\u0005n8\u0002\u021e_\u0003\u0002\u0002\u0002\u021f\u0220\u0005n8\u0002',
  '\u0220a\u0003\u0002\u0002\u0002\u0221\u0222\t\u0010\u0002\u0002\u0222',
  'c\u0003\u0002\u0002\u0002\u0223\u0226\u0005f4\u0002\u0224\u0226\u0005',
  'h5\u0002\u0225\u0223\u0003\u0002\u0002\u0002\u0225\u0224\u0003\u0002',
  '\u0002\u0002\u0226e\u0003\u0002\u0002\u0002\u0227\u0228\t\u000f\u0002',
  '\u0002\u0228\u0229\u0005n8\u0002\u0229g\u0003\u0002\u0002\u0002\u022a',
  '\u022b\t\u000f\u0002\u0002\u022b\u022c\t\u0010\u0002\u0002\u022ci\u0003',
  '\u0002\u0002\u0002\u022d\u022e\u0005n8\u0002\u022ek\u0003\u0002\u0002',
  '\u0002\u022f\u0230\u0005n8\u0002\u0230m\u0003\u0002\u0002\u0002\u0231',
  '\u0235\t\u0011\u0002\u0002\u0232\u0235\u0005p9\u0002\u0233\u0235\u0005',
  'r:\u0002\u0234\u0231\u0003\u0002\u0002\u0002\u0234\u0232\u0003\u0002',
  '\u0002\u0002\u0234\u0233\u0003\u0002\u0002\u0002\u0235o\u0003\u0002',
  '\u0002\u0002\u0236\u0237\t\u0012\u0002\u0002\u0237q\u0003\u0002\u0002',
  '\u0002\u0238\u0242\t\u0013\u0002\u0002\u0239\u0242\t\u0014\u0002\u0002',
  '\u023a\u0242\t\u0015\u0002\u0002\u023b\u0242\t\u0016\u0002\u0002\u023c',
  '\u0242\t\u0017\u0002\u0002\u023d\u0242\t\u0018\u0002\u0002\u023e\u0242',
  '\t\u0019\u0002\u0002\u023f\u0242\t\u001a\u0002\u0002\u0240\u0242\t\u001b',
  '\u0002\u0002\u0241\u0238\u0003\u0002\u0002\u0002\u0241\u0239\u0003\u0002',
  '\u0002\u0002\u0241\u023a\u0003\u0002\u0002\u0002\u0241\u023b\u0003\u0002',
  '\u0002\u0002\u0241\u023c\u0003\u0002\u0002\u0002\u0241\u023d\u0003\u0002',
  '\u0002\u0002\u0241\u023e\u0003\u0002\u0002\u0002\u0241\u023f\u0003\u0002',
  '\u0002\u0002\u0241\u0240\u0003\u0002\u0002\u0002\u0242s\u0003\u0002',
  '\u0002\u0002Hz~\u0085\u008d\u0092\u0098\u00a0\u00a9\u00b0\u00b4\u00c4',
  '\u00ca\u00ce\u00d1\u00d4\u00d8\u00df\u00e8\u00ec\u00f4\u00f7\u00fc\u0100',
  '\u0108\u0111\u0114\u0119\u011d\u0126\u012b\u012e\u0134\u0140\u0144\u014a',
  '\u014c\u0154\u015b\u0162\u016a\u016c\u0172\u0182\u0195\u01a0\u01a6\u01aa',
  '\u01ac\u01b3\u01b7\u01c0\u01c8\u01cc\u01d0\u01d8\u01df\u01e3\u01e7\u01ed',
  '\u01f4\u01fc\u0205\u0209\u020d\u0211\u0215\u021b\u0225\u0234\u0241',
].join('');

var atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

var decisionsToDFA = atn.decisionToState.map(function(ds, index) {
  return new antlr4.dfa.DFA(ds, index);
});

var sharedContextCache = new antlr4.PredictionContextCache();

var literalNames = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  "'=~'",
  "'~='",
  null,
  null,
  null,
  null,
  null,
  "'|>'",
  "':'",
  "'^'",
  "'!'",
  "'*'",
  "'/'",
  "'%'",
  "'+'",
  "'-'",
  "'~'",
  "'<'",
  "'>'",
  "'<='",
  "'>='",
  "'='",
  "'!='",
  "'['",
  "']'",
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  "'|'",
];

var symbolicNames = [
  null,
  'WS',
  'COMMENT',
  'K_SOURCE',
  'K_START',
  'K_END',
  'K_NOW',
  'K_LIVE',
  'K_PARSE',
  'K_SEARCH',
  'K_FIELDS',
  'K_DISPLAY',
  'K_FILTER',
  'K_STATS',
  'K_SORT',
  'K_ORDER',
  'K_ASC',
  'K_DESC',
  'K_HEAD',
  'K_LIMIT',
  'K_TAIL',
  'K_REGEX',
  'K_IN',
  'K_GROUP',
  'K_BY',
  'K_AS',
  'K_AND',
  'K_OR',
  'K_NOT',
  'K_LIKE',
  'K_MATCHES',
  'K_TU_MS',
  'K_TU_MSEC',
  'K_TU_MSECOND',
  'K_TU_S',
  'K_TU_SEC',
  'K_TU_SECOND',
  'K_TU_M',
  'K_TU_MIN',
  'K_TU_MINUTE',
  'K_TU_H',
  'K_TU_HR',
  'K_TU_HOUR',
  'K_TU_D',
  'K_TU_DAY',
  'K_TU_W',
  'K_TU_WEEK',
  'K_TU_MO',
  'K_TU_MON',
  'K_TU_MONTH',
  'K_TU_Q',
  'K_TU_QTR',
  'K_TU_QUARTER',
  'K_TU_Y',
  'K_TU_YR',
  'K_TU_YEAR',
  'RAW_ID',
  'LIT_INTEGER',
  'LIT_NUMBER',
  'SDQUOTED_STRING',
  'SSQUOTED_STRING',
  'CDQUOTED_STRING',
  'CSQUOTED_STRING',
  'QUOTED_IDENT',
  'SYM_EQTILDE',
  'SYM_TILDEEQ',
  'SYM_AT',
  'SYM_COMMA',
  'SYM_LPAREN',
  'SYM_RPAREN',
  'SYM_PIPE',
  'SYM_WRITE',
  'SYM_COLON',
  'SYM_CARET',
  'SYM_NOT',
  'SYM_MUL',
  'SYM_DIV',
  'SYM_MOD',
  'SYM_PLUS',
  'SYM_MINUS',
  'SYM_TILDE',
  'SYM_LT',
  'SYM_GT',
  'SYM_LTEQ',
  'SYM_GTEQ',
  'SYM_EQ',
  'SYM_NEQ',
  'SYM_LBRACKET',
  'SYM_RBRACKET',
  'REGEX_WS',
  'REGEX_COMMENT',
  'REGEX',
  'RE_SDQUOTED_STRING',
  'RE_SSQUOTED_STRING',
  'RE_CDQUOTED_STRING',
  'RE_CSQUOTED_STRING',
  'RE_RAW_ID',
  'RE_SYM_AT',
  'RE_QUOTED_IDENT',
  'SE_WS',
  'SE_COMMENT',
  'SE_K_SEARCH',
  'SE_SYM_LPAREN',
  'SE_SYM_RPAREN',
  'SE_K_AND',
  'SE_K_OR',
  'SE_K_NOT',
  'SE_SDQUOTED_STRING',
  'SE_SSQUOTED_STRING',
  'SE_CDQUOTED_STRING',
  'SE_CSQUOTED_STRING',
  'SE_UNQUOTED_STRING',
  'SE_PIPE',
];

var ruleNames = [
  'query',
  'logQuery',
  'logAesthetic',
  'logSourceStage',
  'logStatsStage',
  'logOp',
  'logAestheticOp',
  'logSource',
  'timeExpr',
  'nowTimeExpr',
  'relativeTimeExpr',
  'iso8601TimeExpr',
  'epochTimeExpr',
  'bareSpaceDelimited',
  'logStats',
  'statsExpr',
  'statsGroupField',
  'logOpFields',
  'fieldSpec',
  'logOpParse',
  'logOpSearch',
  'implicitLogOpSearch',
  'searchExpr',
  'searchTerm',
  'logOpFilter',
  'logOpSort',
  'sortExpr',
  'logOpLimit',
  'expressionRoot',
  'expression',
  'term',
  'likeTerm',
  'func',
  'functionArg',
  'array',
  'arrayElem',
  'number',
  'string',
  'stringOrBareString',
  'regex',
  'regexString',
  'logId',
  'fieldId',
  'aliasId',
  'userId',
  'unquotedUserId',
  'unquotedUserAtId',
  'unquotedUserBareId',
  'quotedUserId',
  'systemId',
  'unquotedSystemId',
  'quotedSystemId',
  'resultId',
  'functionId',
  'rawId',
  'keywords',
  'timeUnitKeywords',
];

function ScrollQLParser(input) {
  antlr4.Parser.call(this, input);
  this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
  this.ruleNames = ruleNames;
  this.literalNames = literalNames;
  this.symbolicNames = symbolicNames;
  return this;
}

ScrollQLParser.prototype = Object.create(antlr4.Parser.prototype);
ScrollQLParser.prototype.constructor = ScrollQLParser;

Object.defineProperty(ScrollQLParser.prototype, 'atn', {
  get: function() {
    return atn;
  },
});

ScrollQLParser.EOF = antlr4.Token.EOF;
ScrollQLParser.WS = 1;
ScrollQLParser.COMMENT = 2;
ScrollQLParser.K_SOURCE = 3;
ScrollQLParser.K_START = 4;
ScrollQLParser.K_END = 5;
ScrollQLParser.K_NOW = 6;
ScrollQLParser.K_LIVE = 7;
ScrollQLParser.K_PARSE = 8;
ScrollQLParser.K_SEARCH = 9;
ScrollQLParser.K_FIELDS = 10;
ScrollQLParser.K_DISPLAY = 11;
ScrollQLParser.K_FILTER = 12;
ScrollQLParser.K_STATS = 13;
ScrollQLParser.K_SORT = 14;
ScrollQLParser.K_ORDER = 15;
ScrollQLParser.K_ASC = 16;
ScrollQLParser.K_DESC = 17;
ScrollQLParser.K_HEAD = 18;
ScrollQLParser.K_LIMIT = 19;
ScrollQLParser.K_TAIL = 20;
ScrollQLParser.K_REGEX = 21;
ScrollQLParser.K_IN = 22;
ScrollQLParser.K_GROUP = 23;
ScrollQLParser.K_BY = 24;
ScrollQLParser.K_AS = 25;
ScrollQLParser.K_AND = 26;
ScrollQLParser.K_OR = 27;
ScrollQLParser.K_NOT = 28;
ScrollQLParser.K_LIKE = 29;
ScrollQLParser.K_MATCHES = 30;
ScrollQLParser.K_TU_MS = 31;
ScrollQLParser.K_TU_MSEC = 32;
ScrollQLParser.K_TU_MSECOND = 33;
ScrollQLParser.K_TU_S = 34;
ScrollQLParser.K_TU_SEC = 35;
ScrollQLParser.K_TU_SECOND = 36;
ScrollQLParser.K_TU_M = 37;
ScrollQLParser.K_TU_MIN = 38;
ScrollQLParser.K_TU_MINUTE = 39;
ScrollQLParser.K_TU_H = 40;
ScrollQLParser.K_TU_HR = 41;
ScrollQLParser.K_TU_HOUR = 42;
ScrollQLParser.K_TU_D = 43;
ScrollQLParser.K_TU_DAY = 44;
ScrollQLParser.K_TU_W = 45;
ScrollQLParser.K_TU_WEEK = 46;
ScrollQLParser.K_TU_MO = 47;
ScrollQLParser.K_TU_MON = 48;
ScrollQLParser.K_TU_MONTH = 49;
ScrollQLParser.K_TU_Q = 50;
ScrollQLParser.K_TU_QTR = 51;
ScrollQLParser.K_TU_QUARTER = 52;
ScrollQLParser.K_TU_Y = 53;
ScrollQLParser.K_TU_YR = 54;
ScrollQLParser.K_TU_YEAR = 55;
ScrollQLParser.RAW_ID = 56;
ScrollQLParser.LIT_INTEGER = 57;
ScrollQLParser.LIT_NUMBER = 58;
ScrollQLParser.SDQUOTED_STRING = 59;
ScrollQLParser.SSQUOTED_STRING = 60;
ScrollQLParser.CDQUOTED_STRING = 61;
ScrollQLParser.CSQUOTED_STRING = 62;
ScrollQLParser.QUOTED_IDENT = 63;
ScrollQLParser.SYM_EQTILDE = 64;
ScrollQLParser.SYM_TILDEEQ = 65;
ScrollQLParser.SYM_AT = 66;
ScrollQLParser.SYM_COMMA = 67;
ScrollQLParser.SYM_LPAREN = 68;
ScrollQLParser.SYM_RPAREN = 69;
ScrollQLParser.SYM_PIPE = 70;
ScrollQLParser.SYM_WRITE = 71;
ScrollQLParser.SYM_COLON = 72;
ScrollQLParser.SYM_CARET = 73;
ScrollQLParser.SYM_NOT = 74;
ScrollQLParser.SYM_MUL = 75;
ScrollQLParser.SYM_DIV = 76;
ScrollQLParser.SYM_MOD = 77;
ScrollQLParser.SYM_PLUS = 78;
ScrollQLParser.SYM_MINUS = 79;
ScrollQLParser.SYM_TILDE = 80;
ScrollQLParser.SYM_LT = 81;
ScrollQLParser.SYM_GT = 82;
ScrollQLParser.SYM_LTEQ = 83;
ScrollQLParser.SYM_GTEQ = 84;
ScrollQLParser.SYM_EQ = 85;
ScrollQLParser.SYM_NEQ = 86;
ScrollQLParser.SYM_LBRACKET = 87;
ScrollQLParser.SYM_RBRACKET = 88;
ScrollQLParser.REGEX_WS = 89;
ScrollQLParser.REGEX_COMMENT = 90;
ScrollQLParser.REGEX = 91;
ScrollQLParser.RE_SDQUOTED_STRING = 92;
ScrollQLParser.RE_SSQUOTED_STRING = 93;
ScrollQLParser.RE_CDQUOTED_STRING = 94;
ScrollQLParser.RE_CSQUOTED_STRING = 95;
ScrollQLParser.RE_RAW_ID = 96;
ScrollQLParser.RE_SYM_AT = 97;
ScrollQLParser.RE_QUOTED_IDENT = 98;
ScrollQLParser.SE_WS = 99;
ScrollQLParser.SE_COMMENT = 100;
ScrollQLParser.SE_K_SEARCH = 101;
ScrollQLParser.SE_SYM_LPAREN = 102;
ScrollQLParser.SE_SYM_RPAREN = 103;
ScrollQLParser.SE_K_AND = 104;
ScrollQLParser.SE_K_OR = 105;
ScrollQLParser.SE_K_NOT = 106;
ScrollQLParser.SE_SDQUOTED_STRING = 107;
ScrollQLParser.SE_SSQUOTED_STRING = 108;
ScrollQLParser.SE_CDQUOTED_STRING = 109;
ScrollQLParser.SE_CSQUOTED_STRING = 110;
ScrollQLParser.SE_UNQUOTED_STRING = 111;
ScrollQLParser.SE_PIPE = 112;

ScrollQLParser.RULE_query = 0;
ScrollQLParser.RULE_logQuery = 1;
ScrollQLParser.RULE_logAesthetic = 2;
ScrollQLParser.RULE_logSourceStage = 3;
ScrollQLParser.RULE_logStatsStage = 4;
ScrollQLParser.RULE_logOp = 5;
ScrollQLParser.RULE_logAestheticOp = 6;
ScrollQLParser.RULE_logSource = 7;
ScrollQLParser.RULE_timeExpr = 8;
ScrollQLParser.RULE_nowTimeExpr = 9;
ScrollQLParser.RULE_relativeTimeExpr = 10;
ScrollQLParser.RULE_iso8601TimeExpr = 11;
ScrollQLParser.RULE_epochTimeExpr = 12;
ScrollQLParser.RULE_bareSpaceDelimited = 13;
ScrollQLParser.RULE_logStats = 14;
ScrollQLParser.RULE_statsExpr = 15;
ScrollQLParser.RULE_statsGroupField = 16;
ScrollQLParser.RULE_logOpFields = 17;
ScrollQLParser.RULE_fieldSpec = 18;
ScrollQLParser.RULE_logOpParse = 19;
ScrollQLParser.RULE_logOpSearch = 20;
ScrollQLParser.RULE_implicitLogOpSearch = 21;
ScrollQLParser.RULE_searchExpr = 22;
ScrollQLParser.RULE_searchTerm = 23;
ScrollQLParser.RULE_logOpFilter = 24;
ScrollQLParser.RULE_logOpSort = 25;
ScrollQLParser.RULE_sortExpr = 26;
ScrollQLParser.RULE_logOpLimit = 27;
ScrollQLParser.RULE_expressionRoot = 28;
ScrollQLParser.RULE_expression = 29;
ScrollQLParser.RULE_term = 30;
ScrollQLParser.RULE_likeTerm = 31;
ScrollQLParser.RULE_func = 32;
ScrollQLParser.RULE_functionArg = 33;
ScrollQLParser.RULE_array = 34;
ScrollQLParser.RULE_arrayElem = 35;
ScrollQLParser.RULE_number = 36;
ScrollQLParser.RULE_string = 37;
ScrollQLParser.RULE_stringOrBareString = 38;
ScrollQLParser.RULE_regex = 39;
ScrollQLParser.RULE_regexString = 40;
ScrollQLParser.RULE_logId = 41;
ScrollQLParser.RULE_fieldId = 42;
ScrollQLParser.RULE_aliasId = 43;
ScrollQLParser.RULE_userId = 44;
ScrollQLParser.RULE_unquotedUserId = 45;
ScrollQLParser.RULE_unquotedUserAtId = 46;
ScrollQLParser.RULE_unquotedUserBareId = 47;
ScrollQLParser.RULE_quotedUserId = 48;
ScrollQLParser.RULE_systemId = 49;
ScrollQLParser.RULE_unquotedSystemId = 50;
ScrollQLParser.RULE_quotedSystemId = 51;
ScrollQLParser.RULE_resultId = 52;
ScrollQLParser.RULE_functionId = 53;
ScrollQLParser.RULE_rawId = 54;
ScrollQLParser.RULE_keywords = 55;
ScrollQLParser.RULE_timeUnitKeywords = 56;

function QueryContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_query;
  return this;
}

QueryContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
QueryContext.prototype.constructor = QueryContext;

QueryContext.prototype.logQuery = function() {
  return this.getTypedRuleContext(LogQueryContext, 0);
};

QueryContext.prototype.EOF = function() {
  return this.getToken(ScrollQLParser.EOF, 0);
};

QueryContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterQuery(this);
  }
};

QueryContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitQuery(this);
  }
};

ScrollQLParser.QueryContext = QueryContext;

ScrollQLParser.prototype.query = function() {
  var localctx = new QueryContext(this, this._ctx, this.state);
  this.enterRule(localctx, 0, ScrollQLParser.RULE_query);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 114;
    this.logQuery();
    this.state = 115;
    this.match(ScrollQLParser.EOF);
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogQueryContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logQuery;
  this.result = null; // ResultIdContext
  return this;
}

LogQueryContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogQueryContext.prototype.constructor = LogQueryContext;

LogQueryContext.prototype.logSourceStage = function() {
  return this.getTypedRuleContext(LogSourceStageContext, 0);
};

LogQueryContext.prototype.SYM_PIPE = function() {
  return this.getToken(ScrollQLParser.SYM_PIPE, 0);
};

LogQueryContext.prototype.logStatsStage = function() {
  return this.getTypedRuleContext(LogStatsStageContext, 0);
};

LogQueryContext.prototype.SYM_WRITE = function() {
  return this.getToken(ScrollQLParser.SYM_WRITE, 0);
};

LogQueryContext.prototype.resultId = function() {
  return this.getTypedRuleContext(ResultIdContext, 0);
};

LogQueryContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogQuery(this);
  }
};

LogQueryContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogQuery(this);
  }
};

ScrollQLParser.LogQueryContext = LogQueryContext;

ScrollQLParser.prototype.logQuery = function() {
  var localctx = new LogQueryContext(this, this._ctx, this.state);
  this.enterRule(localctx, 2, ScrollQLParser.RULE_logQuery);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 117;
    this.logSourceStage();
    this.state = 120;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    if (_la === ScrollQLParser.SYM_PIPE) {
      this.state = 118;
      this.match(ScrollQLParser.SYM_PIPE);
      this.state = 119;
      this.logStatsStage();
    }

    this.state = 124;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    if (_la === ScrollQLParser.SYM_WRITE) {
      this.state = 122;
      this.match(ScrollQLParser.SYM_WRITE);
      this.state = 123;
      localctx.result = this.resultId();
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogAestheticContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logAesthetic;
  this.result = null; // ResultIdContext
  this._logAestheticOp = null; // LogAestheticOpContext
  this.aes = []; // of LogAestheticOpContexts
  return this;
}

LogAestheticContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogAestheticContext.prototype.constructor = LogAestheticContext;

LogAestheticContext.prototype.resultId = function() {
  return this.getTypedRuleContext(ResultIdContext, 0);
};

LogAestheticContext.prototype.SYM_PIPE = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_PIPE);
  } else {
    return this.getToken(ScrollQLParser.SYM_PIPE, i);
  }
};

LogAestheticContext.prototype.logAestheticOp = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(LogAestheticOpContext);
  } else {
    return this.getTypedRuleContext(LogAestheticOpContext, i);
  }
};

LogAestheticContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogAesthetic(this);
  }
};

LogAestheticContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogAesthetic(this);
  }
};

ScrollQLParser.LogAestheticContext = LogAestheticContext;

ScrollQLParser.prototype.logAesthetic = function() {
  var localctx = new LogAestheticContext(this, this._ctx, this.state);
  this.enterRule(localctx, 4, ScrollQLParser.RULE_logAesthetic);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 126;
    localctx.result = this.resultId();
    this.state = 131;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    while (_la === ScrollQLParser.SYM_PIPE) {
      this.state = 127;
      this.match(ScrollQLParser.SYM_PIPE);
      this.state = 128;
      localctx._logAestheticOp = this.logAestheticOp();
      localctx.aes.push(localctx._logAestheticOp);
      this.state = 133;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogSourceStageContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logSourceStage;
  this._logSource = null; // LogSourceContext
  this.source = []; // of LogSourceContexts
  return this;
}

LogSourceStageContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogSourceStageContext.prototype.constructor = LogSourceStageContext;

LogSourceStageContext.prototype.logSource = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(LogSourceContext);
  } else {
    return this.getTypedRuleContext(LogSourceContext, i);
  }
};

LogSourceStageContext.prototype.SYM_PIPE = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_PIPE);
  } else {
    return this.getToken(ScrollQLParser.SYM_PIPE, i);
  }
};

LogSourceStageContext.prototype.implicitLogOpSearch = function() {
  return this.getTypedRuleContext(ImplicitLogOpSearchContext, 0);
};

LogSourceStageContext.prototype.logOp = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(LogOpContext);
  } else {
    return this.getTypedRuleContext(LogOpContext, i);
  }
};

LogSourceStageContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogSourceStage(this);
  }
};

LogSourceStageContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogSourceStage(this);
  }
};

ScrollQLParser.LogSourceStageContext = LogSourceStageContext;

ScrollQLParser.prototype.logSourceStage = function() {
  var localctx = new LogSourceStageContext(this, this._ctx, this.state);
  this.enterRule(localctx, 6, ScrollQLParser.RULE_logSourceStage);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 134;
    localctx._logSource = this.logSource();
    localctx.source.push(localctx._logSource);
    this.state = 139;
    this._errHandler.sync(this);
    var _alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
    while (_alt != 2 && _alt != antlr4.atn.ATN.INVALID_ALT_NUMBER) {
      if (_alt === 1) {
        this.state = 135;
        this.match(ScrollQLParser.SYM_PIPE);
        this.state = 136;
        localctx._logSource = this.logSource();
        localctx.source.push(localctx._logSource);
      }
      this.state = 141;
      this._errHandler.sync(this);
      _alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
    }

    this.state = 144;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 4, this._ctx);
    if (la_ === 1) {
      this.state = 142;
      this.match(ScrollQLParser.SYM_PIPE);
      this.state = 143;
      this.implicitLogOpSearch();
    }
    this.state = 150;
    this._errHandler.sync(this);
    var _alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
    while (_alt != 2 && _alt != antlr4.atn.ATN.INVALID_ALT_NUMBER) {
      if (_alt === 1) {
        this.state = 146;
        this.match(ScrollQLParser.SYM_PIPE);
        this.state = 147;
        this.logOp();
      }
      this.state = 152;
      this._errHandler.sync(this);
      _alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogStatsStageContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logStatsStage;
  this.stats = null; // LogStatsContext
  return this;
}

LogStatsStageContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogStatsStageContext.prototype.constructor = LogStatsStageContext;

LogStatsStageContext.prototype.logStats = function() {
  return this.getTypedRuleContext(LogStatsContext, 0);
};

LogStatsStageContext.prototype.SYM_PIPE = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_PIPE);
  } else {
    return this.getToken(ScrollQLParser.SYM_PIPE, i);
  }
};

LogStatsStageContext.prototype.logOp = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(LogOpContext);
  } else {
    return this.getTypedRuleContext(LogOpContext, i);
  }
};

LogStatsStageContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogStatsStage(this);
  }
};

LogStatsStageContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogStatsStage(this);
  }
};

ScrollQLParser.LogStatsStageContext = LogStatsStageContext;

ScrollQLParser.prototype.logStatsStage = function() {
  var localctx = new LogStatsStageContext(this, this._ctx, this.state);
  this.enterRule(localctx, 8, ScrollQLParser.RULE_logStatsStage);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 153;
    localctx.stats = this.logStats();
    this.state = 158;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    while (_la === ScrollQLParser.SYM_PIPE) {
      this.state = 154;
      this.match(ScrollQLParser.SYM_PIPE);
      this.state = 155;
      this.logOp();
      this.state = 160;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogOpContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logOp;
  return this;
}

LogOpContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogOpContext.prototype.constructor = LogOpContext;

LogOpContext.prototype.logOpFields = function() {
  return this.getTypedRuleContext(LogOpFieldsContext, 0);
};

LogOpContext.prototype.logOpParse = function() {
  return this.getTypedRuleContext(LogOpParseContext, 0);
};

LogOpContext.prototype.logOpFilter = function() {
  return this.getTypedRuleContext(LogOpFilterContext, 0);
};

LogOpContext.prototype.logOpSearch = function() {
  return this.getTypedRuleContext(LogOpSearchContext, 0);
};

LogOpContext.prototype.logOpSort = function() {
  return this.getTypedRuleContext(LogOpSortContext, 0);
};

LogOpContext.prototype.logOpLimit = function() {
  return this.getTypedRuleContext(LogOpLimitContext, 0);
};

LogOpContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogOp(this);
  }
};

LogOpContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogOp(this);
  }
};

ScrollQLParser.LogOpContext = LogOpContext;

ScrollQLParser.prototype.logOp = function() {
  var localctx = new LogOpContext(this, this._ctx, this.state);
  this.enterRule(localctx, 10, ScrollQLParser.RULE_logOp);
  try {
    this.state = 167;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.K_FIELDS:
      case ScrollQLParser.K_DISPLAY:
        this.enterOuterAlt(localctx, 1);
        this.state = 161;
        this.logOpFields();
        break;
      case ScrollQLParser.K_PARSE:
        this.enterOuterAlt(localctx, 2);
        this.state = 162;
        this.logOpParse();
        break;
      case ScrollQLParser.K_FILTER:
        this.enterOuterAlt(localctx, 3);
        this.state = 163;
        this.logOpFilter();
        break;
      case ScrollQLParser.K_SEARCH:
        this.enterOuterAlt(localctx, 4);
        this.state = 164;
        this.logOpSearch();
        break;
      case ScrollQLParser.K_SORT:
      case ScrollQLParser.K_ORDER:
        this.enterOuterAlt(localctx, 5);
        this.state = 165;
        this.logOpSort();
        break;
      case ScrollQLParser.K_HEAD:
      case ScrollQLParser.K_LIMIT:
      case ScrollQLParser.K_TAIL:
        this.enterOuterAlt(localctx, 6);
        this.state = 166;
        this.logOpLimit();
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogAestheticOpContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logAestheticOp;
  this.aesFun = null; // FunctionIdContext
  this._rawId = null; // RawIdContext
  this.params = []; // of RawIdContexts
  this._fieldId = null; // FieldIdContext
  this.vals = []; // of FieldIdContexts
  return this;
}

LogAestheticOpContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogAestheticOpContext.prototype.constructor = LogAestheticOpContext;

LogAestheticOpContext.prototype.functionId = function() {
  return this.getTypedRuleContext(FunctionIdContext, 0);
};

LogAestheticOpContext.prototype.SYM_EQ = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_EQ);
  } else {
    return this.getToken(ScrollQLParser.SYM_EQ, i);
  }
};

LogAestheticOpContext.prototype.rawId = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(RawIdContext);
  } else {
    return this.getTypedRuleContext(RawIdContext, i);
  }
};

LogAestheticOpContext.prototype.fieldId = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(FieldIdContext);
  } else {
    return this.getTypedRuleContext(FieldIdContext, i);
  }
};

LogAestheticOpContext.prototype.SYM_COMMA = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_COMMA);
  } else {
    return this.getToken(ScrollQLParser.SYM_COMMA, i);
  }
};

LogAestheticOpContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogAestheticOp(this);
  }
};

LogAestheticOpContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogAestheticOp(this);
  }
};

ScrollQLParser.LogAestheticOpContext = LogAestheticOpContext;

ScrollQLParser.prototype.logAestheticOp = function() {
  var localctx = new LogAestheticOpContext(this, this._ctx, this.state);
  this.enterRule(localctx, 12, ScrollQLParser.RULE_logAestheticOp);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 169;
    localctx.aesFun = this.functionId();
    this.state = 178;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    while (
      ((_la & ~0x1f) == 0 &&
        ((1 << _la) &
          ((1 << ScrollQLParser.K_SOURCE) |
            (1 << ScrollQLParser.K_START) |
            (1 << ScrollQLParser.K_END) |
            (1 << ScrollQLParser.K_NOW) |
            (1 << ScrollQLParser.K_LIVE) |
            (1 << ScrollQLParser.K_PARSE) |
            (1 << ScrollQLParser.K_SEARCH) |
            (1 << ScrollQLParser.K_FIELDS) |
            (1 << ScrollQLParser.K_DISPLAY) |
            (1 << ScrollQLParser.K_FILTER) |
            (1 << ScrollQLParser.K_STATS) |
            (1 << ScrollQLParser.K_SORT) |
            (1 << ScrollQLParser.K_ORDER) |
            (1 << ScrollQLParser.K_ASC) |
            (1 << ScrollQLParser.K_DESC) |
            (1 << ScrollQLParser.K_HEAD) |
            (1 << ScrollQLParser.K_LIMIT) |
            (1 << ScrollQLParser.K_TAIL) |
            (1 << ScrollQLParser.K_REGEX) |
            (1 << ScrollQLParser.K_IN) |
            (1 << ScrollQLParser.K_GROUP) |
            (1 << ScrollQLParser.K_BY) |
            (1 << ScrollQLParser.K_AS) |
            (1 << ScrollQLParser.K_AND) |
            (1 << ScrollQLParser.K_OR) |
            (1 << ScrollQLParser.K_NOT) |
            (1 << ScrollQLParser.K_LIKE) |
            (1 << ScrollQLParser.K_MATCHES) |
            (1 << ScrollQLParser.K_TU_MS))) !==
          0) ||
      (((_la - 32) & ~0x1f) == 0 &&
        ((1 << (_la - 32)) &
          ((1 << (ScrollQLParser.K_TU_MSEC - 32)) |
            (1 << (ScrollQLParser.K_TU_MSECOND - 32)) |
            (1 << (ScrollQLParser.K_TU_S - 32)) |
            (1 << (ScrollQLParser.K_TU_SEC - 32)) |
            (1 << (ScrollQLParser.K_TU_SECOND - 32)) |
            (1 << (ScrollQLParser.K_TU_M - 32)) |
            (1 << (ScrollQLParser.K_TU_MIN - 32)) |
            (1 << (ScrollQLParser.K_TU_MINUTE - 32)) |
            (1 << (ScrollQLParser.K_TU_H - 32)) |
            (1 << (ScrollQLParser.K_TU_HR - 32)) |
            (1 << (ScrollQLParser.K_TU_HOUR - 32)) |
            (1 << (ScrollQLParser.K_TU_D - 32)) |
            (1 << (ScrollQLParser.K_TU_DAY - 32)) |
            (1 << (ScrollQLParser.K_TU_W - 32)) |
            (1 << (ScrollQLParser.K_TU_WEEK - 32)) |
            (1 << (ScrollQLParser.K_TU_MO - 32)) |
            (1 << (ScrollQLParser.K_TU_MON - 32)) |
            (1 << (ScrollQLParser.K_TU_MONTH - 32)) |
            (1 << (ScrollQLParser.K_TU_Q - 32)) |
            (1 << (ScrollQLParser.K_TU_QTR - 32)) |
            (1 << (ScrollQLParser.K_TU_QUARTER - 32)) |
            (1 << (ScrollQLParser.K_TU_Y - 32)) |
            (1 << (ScrollQLParser.K_TU_YR - 32)) |
            (1 << (ScrollQLParser.K_TU_YEAR - 32)) |
            (1 << (ScrollQLParser.RAW_ID - 32)))) !==
          0) ||
      _la === ScrollQLParser.RE_RAW_ID
    ) {
      this.state = 170;
      localctx._rawId = this.rawId();
      localctx.params.push(localctx._rawId);
      this.state = 171;
      this.match(ScrollQLParser.SYM_EQ);
      this.state = 172;
      localctx._fieldId = this.fieldId();
      localctx.vals.push(localctx._fieldId);
      this.state = 174;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
      if (_la === ScrollQLParser.SYM_COMMA) {
        this.state = 173;
        this.match(ScrollQLParser.SYM_COMMA);
      }

      this.state = 180;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogSourceContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logSource;
  this.source = null; // LogIdContext
  this.start = null; // TimeExprContext
  this.end = null; // TimeExprContext
  return this;
}

LogSourceContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogSourceContext.prototype.constructor = LogSourceContext;

LogSourceContext.prototype.K_SOURCE = function() {
  return this.getToken(ScrollQLParser.K_SOURCE, 0);
};

LogSourceContext.prototype.K_START = function() {
  return this.getToken(ScrollQLParser.K_START, 0);
};

LogSourceContext.prototype.SYM_EQ = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_EQ);
  } else {
    return this.getToken(ScrollQLParser.SYM_EQ, i);
  }
};

LogSourceContext.prototype.K_END = function() {
  return this.getToken(ScrollQLParser.K_END, 0);
};

LogSourceContext.prototype.logId = function() {
  return this.getTypedRuleContext(LogIdContext, 0);
};

LogSourceContext.prototype.timeExpr = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(TimeExprContext);
  } else {
    return this.getTypedRuleContext(TimeExprContext, i);
  }
};

LogSourceContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogSource(this);
  }
};

LogSourceContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogSource(this);
  }
};

ScrollQLParser.LogSourceContext = LogSourceContext;

ScrollQLParser.prototype.logSource = function() {
  var localctx = new LogSourceContext(this, this._ctx, this.state);
  this.enterRule(localctx, 14, ScrollQLParser.RULE_logSource);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 181;
    this.match(ScrollQLParser.K_SOURCE);
    this.state = 182;
    localctx.source = this.logId();
    this.state = 183;
    this.match(ScrollQLParser.K_START);
    this.state = 184;
    this.match(ScrollQLParser.SYM_EQ);
    this.state = 185;
    localctx.start = this.timeExpr();
    this.state = 186;
    this.match(ScrollQLParser.K_END);
    this.state = 187;
    this.match(ScrollQLParser.SYM_EQ);
    this.state = 188;
    localctx.end = this.timeExpr();
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function TimeExprContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_timeExpr;
  return this;
}

TimeExprContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
TimeExprContext.prototype.constructor = TimeExprContext;

TimeExprContext.prototype.nowTimeExpr = function() {
  return this.getTypedRuleContext(NowTimeExprContext, 0);
};

TimeExprContext.prototype.relativeTimeExpr = function() {
  return this.getTypedRuleContext(RelativeTimeExprContext, 0);
};

TimeExprContext.prototype.epochTimeExpr = function() {
  return this.getTypedRuleContext(EpochTimeExprContext, 0);
};

TimeExprContext.prototype.iso8601TimeExpr = function() {
  return this.getTypedRuleContext(Iso8601TimeExprContext, 0);
};

TimeExprContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeExpr(this);
  }
};

TimeExprContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeExpr(this);
  }
};

ScrollQLParser.TimeExprContext = TimeExprContext;

ScrollQLParser.prototype.timeExpr = function() {
  var localctx = new TimeExprContext(this, this._ctx, this.state);
  this.enterRule(localctx, 16, ScrollQLParser.RULE_timeExpr);
  try {
    this.state = 194;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 10, this._ctx);
    switch (la_) {
      case 1:
        this.enterOuterAlt(localctx, 1);
        this.state = 190;
        this.nowTimeExpr();
        break;

      case 2:
        this.enterOuterAlt(localctx, 2);
        this.state = 191;
        this.relativeTimeExpr();
        break;

      case 3:
        this.enterOuterAlt(localctx, 3);
        this.state = 192;
        this.epochTimeExpr();
        break;

      case 4:
        this.enterOuterAlt(localctx, 4);
        this.state = 193;
        this.iso8601TimeExpr();
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function NowTimeExprContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_nowTimeExpr;
  return this;
}

NowTimeExprContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
NowTimeExprContext.prototype.constructor = NowTimeExprContext;

NowTimeExprContext.prototype.K_NOW = function() {
  return this.getToken(ScrollQLParser.K_NOW, 0);
};

NowTimeExprContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterNowTimeExpr(this);
  }
};

NowTimeExprContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitNowTimeExpr(this);
  }
};

ScrollQLParser.NowTimeExprContext = NowTimeExprContext;

ScrollQLParser.prototype.nowTimeExpr = function() {
  var localctx = new NowTimeExprContext(this, this._ctx, this.state);
  this.enterRule(localctx, 18, ScrollQLParser.RULE_nowTimeExpr);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 196;
    this.match(ScrollQLParser.K_NOW);
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function RelativeTimeExprContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_relativeTimeExpr;
  return this;
}

RelativeTimeExprContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
RelativeTimeExprContext.prototype.constructor = RelativeTimeExprContext;

RelativeTimeExprContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function PosRelativeTimeExprContext(parser, ctx) {
  RelativeTimeExprContext.call(this, parser);
  this.num = null; // Token;
  RelativeTimeExprContext.prototype.copyFrom.call(this, ctx);
  return this;
}

PosRelativeTimeExprContext.prototype = Object.create(RelativeTimeExprContext.prototype);
PosRelativeTimeExprContext.prototype.constructor = PosRelativeTimeExprContext;

ScrollQLParser.PosRelativeTimeExprContext = PosRelativeTimeExprContext;

PosRelativeTimeExprContext.prototype.timeUnitKeywords = function() {
  return this.getTypedRuleContext(TimeUnitKeywordsContext, 0);
};

PosRelativeTimeExprContext.prototype.SYM_PLUS = function() {
  return this.getToken(ScrollQLParser.SYM_PLUS, 0);
};

PosRelativeTimeExprContext.prototype.LIT_INTEGER = function() {
  return this.getToken(ScrollQLParser.LIT_INTEGER, 0);
};

PosRelativeTimeExprContext.prototype.LIT_NUMBER = function() {
  return this.getToken(ScrollQLParser.LIT_NUMBER, 0);
};
PosRelativeTimeExprContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterPosRelativeTimeExpr(this);
  }
};

PosRelativeTimeExprContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitPosRelativeTimeExpr(this);
  }
};

function NegRelativeTimeExprContext(parser, ctx) {
  RelativeTimeExprContext.call(this, parser);
  this.num = null; // Token;
  RelativeTimeExprContext.prototype.copyFrom.call(this, ctx);
  return this;
}

NegRelativeTimeExprContext.prototype = Object.create(RelativeTimeExprContext.prototype);
NegRelativeTimeExprContext.prototype.constructor = NegRelativeTimeExprContext;

ScrollQLParser.NegRelativeTimeExprContext = NegRelativeTimeExprContext;

NegRelativeTimeExprContext.prototype.SYM_MINUS = function() {
  return this.getToken(ScrollQLParser.SYM_MINUS, 0);
};

NegRelativeTimeExprContext.prototype.timeUnitKeywords = function() {
  return this.getTypedRuleContext(TimeUnitKeywordsContext, 0);
};

NegRelativeTimeExprContext.prototype.LIT_INTEGER = function() {
  return this.getToken(ScrollQLParser.LIT_INTEGER, 0);
};

NegRelativeTimeExprContext.prototype.LIT_NUMBER = function() {
  return this.getToken(ScrollQLParser.LIT_NUMBER, 0);
};
NegRelativeTimeExprContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterNegRelativeTimeExpr(this);
  }
};

NegRelativeTimeExprContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitNegRelativeTimeExpr(this);
  }
};

ScrollQLParser.RelativeTimeExprContext = RelativeTimeExprContext;

ScrollQLParser.prototype.relativeTimeExpr = function() {
  var localctx = new RelativeTimeExprContext(this, this._ctx, this.state);
  this.enterRule(localctx, 20, ScrollQLParser.RULE_relativeTimeExpr);
  var _la = 0; // Token type
  try {
    this.state = 210;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.SYM_MINUS:
        localctx = new NegRelativeTimeExprContext(this, localctx);
        this.enterOuterAlt(localctx, 1);
        this.state = 198;
        this.match(ScrollQLParser.SYM_MINUS);
        this.state = 200;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        if (_la === ScrollQLParser.LIT_INTEGER || _la === ScrollQLParser.LIT_NUMBER) {
          this.state = 199;
          localctx.num = this._input.LT(1);
          _la = this._input.LA(1);
          if (!(_la === ScrollQLParser.LIT_INTEGER || _la === ScrollQLParser.LIT_NUMBER)) {
            localctx.num = this._errHandler.recoverInline(this);
          } else {
            this._errHandler.reportMatch(this);
            this.consume();
          }
        }

        this.state = 202;
        this.timeUnitKeywords();
        break;
      case ScrollQLParser.K_TU_MS:
      case ScrollQLParser.K_TU_MSEC:
      case ScrollQLParser.K_TU_MSECOND:
      case ScrollQLParser.K_TU_S:
      case ScrollQLParser.K_TU_SEC:
      case ScrollQLParser.K_TU_SECOND:
      case ScrollQLParser.K_TU_M:
      case ScrollQLParser.K_TU_MIN:
      case ScrollQLParser.K_TU_MINUTE:
      case ScrollQLParser.K_TU_H:
      case ScrollQLParser.K_TU_HR:
      case ScrollQLParser.K_TU_HOUR:
      case ScrollQLParser.K_TU_D:
      case ScrollQLParser.K_TU_DAY:
      case ScrollQLParser.K_TU_W:
      case ScrollQLParser.K_TU_WEEK:
      case ScrollQLParser.K_TU_MO:
      case ScrollQLParser.K_TU_MON:
      case ScrollQLParser.K_TU_MONTH:
      case ScrollQLParser.K_TU_Q:
      case ScrollQLParser.K_TU_QTR:
      case ScrollQLParser.K_TU_QUARTER:
      case ScrollQLParser.K_TU_Y:
      case ScrollQLParser.K_TU_YR:
      case ScrollQLParser.K_TU_YEAR:
      case ScrollQLParser.LIT_INTEGER:
      case ScrollQLParser.LIT_NUMBER:
      case ScrollQLParser.SYM_PLUS:
        localctx = new PosRelativeTimeExprContext(this, localctx);
        this.enterOuterAlt(localctx, 2);
        this.state = 204;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        if (_la === ScrollQLParser.SYM_PLUS) {
          this.state = 203;
          this.match(ScrollQLParser.SYM_PLUS);
        }

        this.state = 207;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        if (_la === ScrollQLParser.LIT_INTEGER || _la === ScrollQLParser.LIT_NUMBER) {
          this.state = 206;
          localctx.num = this._input.LT(1);
          _la = this._input.LA(1);
          if (!(_la === ScrollQLParser.LIT_INTEGER || _la === ScrollQLParser.LIT_NUMBER)) {
            localctx.num = this._errHandler.recoverInline(this);
          } else {
            this._errHandler.reportMatch(this);
            this.consume();
          }
        }

        this.state = 209;
        this.timeUnitKeywords();
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function Iso8601TimeExprContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_iso8601TimeExpr;
  this.datetime = null; // StringOrBareStringContext
  this.uqdatetime = null; // BareSpaceDelimitedContext
  return this;
}

Iso8601TimeExprContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
Iso8601TimeExprContext.prototype.constructor = Iso8601TimeExprContext;

Iso8601TimeExprContext.prototype.stringOrBareString = function() {
  return this.getTypedRuleContext(StringOrBareStringContext, 0);
};

Iso8601TimeExprContext.prototype.bareSpaceDelimited = function() {
  return this.getTypedRuleContext(BareSpaceDelimitedContext, 0);
};

Iso8601TimeExprContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterIso8601TimeExpr(this);
  }
};

Iso8601TimeExprContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitIso8601TimeExpr(this);
  }
};

ScrollQLParser.Iso8601TimeExprContext = Iso8601TimeExprContext;

ScrollQLParser.prototype.iso8601TimeExpr = function() {
  var localctx = new Iso8601TimeExprContext(this, this._ctx, this.state);
  this.enterRule(localctx, 22, ScrollQLParser.RULE_iso8601TimeExpr);
  try {
    this.state = 214;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 15, this._ctx);
    switch (la_) {
      case 1:
        this.enterOuterAlt(localctx, 1);
        this.state = 212;
        localctx.datetime = this.stringOrBareString();
        break;

      case 2:
        this.enterOuterAlt(localctx, 2);
        this.state = 213;
        localctx.uqdatetime = this.bareSpaceDelimited();
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function EpochTimeExprContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_epochTimeExpr;
  this.num = null; // Token
  return this;
}

EpochTimeExprContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
EpochTimeExprContext.prototype.constructor = EpochTimeExprContext;

EpochTimeExprContext.prototype.LIT_INTEGER = function() {
  return this.getToken(ScrollQLParser.LIT_INTEGER, 0);
};

EpochTimeExprContext.prototype.LIT_NUMBER = function() {
  return this.getToken(ScrollQLParser.LIT_NUMBER, 0);
};

EpochTimeExprContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterEpochTimeExpr(this);
  }
};

EpochTimeExprContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitEpochTimeExpr(this);
  }
};

ScrollQLParser.EpochTimeExprContext = EpochTimeExprContext;

ScrollQLParser.prototype.epochTimeExpr = function() {
  var localctx = new EpochTimeExprContext(this, this._ctx, this.state);
  this.enterRule(localctx, 24, ScrollQLParser.RULE_epochTimeExpr);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 216;
    localctx.num = this._input.LT(1);
    _la = this._input.LA(1);
    if (!(_la === ScrollQLParser.LIT_INTEGER || _la === ScrollQLParser.LIT_NUMBER)) {
      localctx.num = this._errHandler.recoverInline(this);
    } else {
      this._errHandler.reportMatch(this);
      this.consume();
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function BareSpaceDelimitedContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_bareSpaceDelimited;
  return this;
}

BareSpaceDelimitedContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
BareSpaceDelimitedContext.prototype.constructor = BareSpaceDelimitedContext;

BareSpaceDelimitedContext.prototype.SYM_MINUS = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_MINUS);
  } else {
    return this.getToken(ScrollQLParser.SYM_MINUS, i);
  }
};

BareSpaceDelimitedContext.prototype.LIT_INTEGER = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.LIT_INTEGER);
  } else {
    return this.getToken(ScrollQLParser.LIT_INTEGER, i);
  }
};

BareSpaceDelimitedContext.prototype.LIT_NUMBER = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.LIT_NUMBER);
  } else {
    return this.getToken(ScrollQLParser.LIT_NUMBER, i);
  }
};

BareSpaceDelimitedContext.prototype.SYM_COLON = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_COLON);
  } else {
    return this.getToken(ScrollQLParser.SYM_COLON, i);
  }
};

BareSpaceDelimitedContext.prototype.RAW_ID = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.RAW_ID);
  } else {
    return this.getToken(ScrollQLParser.RAW_ID, i);
  }
};

BareSpaceDelimitedContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterBareSpaceDelimited(this);
  }
};

BareSpaceDelimitedContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitBareSpaceDelimited(this);
  }
};

ScrollQLParser.BareSpaceDelimitedContext = BareSpaceDelimitedContext;

ScrollQLParser.prototype.bareSpaceDelimited = function() {
  var localctx = new BareSpaceDelimitedContext(this, this._ctx, this.state);
  this.enterRule(localctx, 26, ScrollQLParser.RULE_bareSpaceDelimited);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 221;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    while (
      ((_la - 56) & ~0x1f) == 0 &&
      ((1 << (_la - 56)) &
        ((1 << (ScrollQLParser.RAW_ID - 56)) |
          (1 << (ScrollQLParser.LIT_INTEGER - 56)) |
          (1 << (ScrollQLParser.LIT_NUMBER - 56)) |
          (1 << (ScrollQLParser.SYM_COLON - 56)) |
          (1 << (ScrollQLParser.SYM_MINUS - 56)))) !==
        0
    ) {
      this.state = 218;
      _la = this._input.LA(1);
      if (
        !(
          ((_la - 56) & ~0x1f) == 0 &&
          ((1 << (_la - 56)) &
            ((1 << (ScrollQLParser.RAW_ID - 56)) |
              (1 << (ScrollQLParser.LIT_INTEGER - 56)) |
              (1 << (ScrollQLParser.LIT_NUMBER - 56)) |
              (1 << (ScrollQLParser.SYM_COLON - 56)) |
              (1 << (ScrollQLParser.SYM_MINUS - 56)))) !==
            0
        )
      ) {
        this._errHandler.recoverInline(this);
      } else {
        this._errHandler.reportMatch(this);
        this.consume();
      }
      this.state = 223;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogStatsContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logStats;
  this._statsExpr = null; // StatsExprContext
  this.expr = []; // of StatsExprContexts
  this._statsGroupField = null; // StatsGroupFieldContext
  this.groups = []; // of StatsGroupFieldContexts
  return this;
}

LogStatsContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogStatsContext.prototype.constructor = LogStatsContext;

LogStatsContext.prototype.K_STATS = function() {
  return this.getToken(ScrollQLParser.K_STATS, 0);
};

LogStatsContext.prototype.statsExpr = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(StatsExprContext);
  } else {
    return this.getTypedRuleContext(StatsExprContext, i);
  }
};

LogStatsContext.prototype.SYM_COMMA = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_COMMA);
  } else {
    return this.getToken(ScrollQLParser.SYM_COMMA, i);
  }
};

LogStatsContext.prototype.K_BY = function() {
  return this.getToken(ScrollQLParser.K_BY, 0);
};

LogStatsContext.prototype.statsGroupField = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(StatsGroupFieldContext);
  } else {
    return this.getTypedRuleContext(StatsGroupFieldContext, i);
  }
};

LogStatsContext.prototype.K_GROUP = function() {
  return this.getToken(ScrollQLParser.K_GROUP, 0);
};

LogStatsContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogStats(this);
  }
};

LogStatsContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogStats(this);
  }
};

ScrollQLParser.LogStatsContext = LogStatsContext;

ScrollQLParser.prototype.logStats = function() {
  var localctx = new LogStatsContext(this, this._ctx, this.state);
  this.enterRule(localctx, 28, ScrollQLParser.RULE_logStats);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 224;
    this.match(ScrollQLParser.K_STATS);
    this.state = 225;
    localctx._statsExpr = this.statsExpr();
    localctx.expr.push(localctx._statsExpr);
    this.state = 230;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    while (_la === ScrollQLParser.SYM_COMMA) {
      this.state = 226;
      this.match(ScrollQLParser.SYM_COMMA);
      this.state = 227;
      localctx._statsExpr = this.statsExpr();
      localctx.expr.push(localctx._statsExpr);
      this.state = 232;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
    }
    this.state = 245;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    if (_la === ScrollQLParser.K_GROUP || _la === ScrollQLParser.K_BY) {
      this.state = 234;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
      if (_la === ScrollQLParser.K_GROUP) {
        this.state = 233;
        this.match(ScrollQLParser.K_GROUP);
      }

      this.state = 236;
      this.match(ScrollQLParser.K_BY);
      this.state = 237;
      localctx._statsGroupField = this.statsGroupField();
      localctx.groups.push(localctx._statsGroupField);
      this.state = 242;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
      while (_la === ScrollQLParser.SYM_COMMA) {
        this.state = 238;
        this.match(ScrollQLParser.SYM_COMMA);
        this.state = 239;
        localctx._statsGroupField = this.statsGroupField();
        localctx.groups.push(localctx._statsGroupField);
        this.state = 244;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
      }
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function StatsExprContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_statsExpr;
  this.expr = null; // ExpressionRootContext
  this.proj = null; // AliasIdContext
  return this;
}

StatsExprContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
StatsExprContext.prototype.constructor = StatsExprContext;

StatsExprContext.prototype.expressionRoot = function() {
  return this.getTypedRuleContext(ExpressionRootContext, 0);
};

StatsExprContext.prototype.K_AS = function() {
  return this.getToken(ScrollQLParser.K_AS, 0);
};

StatsExprContext.prototype.aliasId = function() {
  return this.getTypedRuleContext(AliasIdContext, 0);
};

StatsExprContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterStatsExpr(this);
  }
};

StatsExprContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitStatsExpr(this);
  }
};

ScrollQLParser.StatsExprContext = StatsExprContext;

ScrollQLParser.prototype.statsExpr = function() {
  var localctx = new StatsExprContext(this, this._ctx, this.state);
  this.enterRule(localctx, 30, ScrollQLParser.RULE_statsExpr);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 247;
    localctx.expr = this.expressionRoot();
    this.state = 250;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    if (_la === ScrollQLParser.K_AS) {
      this.state = 248;
      this.match(ScrollQLParser.K_AS);
      this.state = 249;
      localctx.proj = this.aliasId();
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function StatsGroupFieldContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_statsGroupField;
  return this;
}

StatsGroupFieldContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
StatsGroupFieldContext.prototype.constructor = StatsGroupFieldContext;

StatsGroupFieldContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function StatsGroupFieldIdContext(parser, ctx) {
  StatsGroupFieldContext.call(this, parser);
  StatsGroupFieldContext.prototype.copyFrom.call(this, ctx);
  return this;
}

StatsGroupFieldIdContext.prototype = Object.create(StatsGroupFieldContext.prototype);
StatsGroupFieldIdContext.prototype.constructor = StatsGroupFieldIdContext;

ScrollQLParser.StatsGroupFieldIdContext = StatsGroupFieldIdContext;

StatsGroupFieldIdContext.prototype.fieldId = function() {
  return this.getTypedRuleContext(FieldIdContext, 0);
};
StatsGroupFieldIdContext.prototype.enterRule = function(listener) {
  console.log(this);
  if (listener instanceof ScrollQLParserListener) {
    listener.enterStatsGroupFieldId(this);
  }
};

StatsGroupFieldIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitStatsGroupFieldId(this);
  }
};

function StatsGroupFieldProjectionContext(parser, ctx) {
  StatsGroupFieldContext.call(this, parser);
  StatsGroupFieldContext.prototype.copyFrom.call(this, ctx);
  return this;
}

StatsGroupFieldProjectionContext.prototype = Object.create(StatsGroupFieldContext.prototype);
StatsGroupFieldProjectionContext.prototype.constructor = StatsGroupFieldProjectionContext;

ScrollQLParser.StatsGroupFieldProjectionContext = StatsGroupFieldProjectionContext;

StatsGroupFieldProjectionContext.prototype.fieldSpec = function() {
  return this.getTypedRuleContext(FieldSpecContext, 0);
};
StatsGroupFieldProjectionContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterStatsGroupFieldProjection(this);
  }
};

StatsGroupFieldProjectionContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitStatsGroupFieldProjection(this);
  }
};

ScrollQLParser.StatsGroupFieldContext = StatsGroupFieldContext;

ScrollQLParser.prototype.statsGroupField = function() {
  var localctx = new StatsGroupFieldContext(this, this._ctx, this.state);
  this.enterRule(localctx, 32, ScrollQLParser.RULE_statsGroupField);
  try {
    this.state = 254;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 22, this._ctx);
    switch (la_) {
      case 1:
        localctx = new StatsGroupFieldIdContext(this, localctx);
        this.enterOuterAlt(localctx, 1);
        this.state = 252;
        this.fieldId();
        break;

      case 2:
        localctx = new StatsGroupFieldProjectionContext(this, localctx);
        this.enterOuterAlt(localctx, 2);
        this.state = 253;
        this.fieldSpec();
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogOpFieldsContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logOpFields;
  return this;
}

LogOpFieldsContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogOpFieldsContext.prototype.constructor = LogOpFieldsContext;

LogOpFieldsContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function LogOpFieldsDisplayContext(parser, ctx) {
  LogOpFieldsContext.call(this, parser);
  this._fieldSpec = null; // FieldSpecContext;
  this.fields = []; // of FieldSpecContexts;
  LogOpFieldsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

LogOpFieldsDisplayContext.prototype = Object.create(LogOpFieldsContext.prototype);
LogOpFieldsDisplayContext.prototype.constructor = LogOpFieldsDisplayContext;

ScrollQLParser.LogOpFieldsDisplayContext = LogOpFieldsDisplayContext;

LogOpFieldsDisplayContext.prototype.K_DISPLAY = function() {
  return this.getToken(ScrollQLParser.K_DISPLAY, 0);
};

LogOpFieldsDisplayContext.prototype.fieldSpec = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(FieldSpecContext);
  } else {
    return this.getTypedRuleContext(FieldSpecContext, i);
  }
};

LogOpFieldsDisplayContext.prototype.SYM_COMMA = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_COMMA);
  } else {
    return this.getToken(ScrollQLParser.SYM_COMMA, i);
  }
};

LogOpFieldsDisplayContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogOpFieldsDisplay(this);
  }
};

LogOpFieldsDisplayContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogOpFieldsDisplay(this);
  }
};

function LogOpFieldsFieldsContext(parser, ctx) {
  LogOpFieldsContext.call(this, parser);
  this._fieldSpec = null; // FieldSpecContext;
  this.fields = []; // of FieldSpecContexts;
  LogOpFieldsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

LogOpFieldsFieldsContext.prototype = Object.create(LogOpFieldsContext.prototype);
LogOpFieldsFieldsContext.prototype.constructor = LogOpFieldsFieldsContext;

ScrollQLParser.LogOpFieldsFieldsContext = LogOpFieldsFieldsContext;

LogOpFieldsFieldsContext.prototype.K_FIELDS = function() {
  return this.getToken(ScrollQLParser.K_FIELDS, 0);
};

LogOpFieldsFieldsContext.prototype.fieldSpec = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(FieldSpecContext);
  } else {
    return this.getTypedRuleContext(FieldSpecContext, i);
  }
};

LogOpFieldsFieldsContext.prototype.SYM_COMMA = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_COMMA);
  } else {
    return this.getToken(ScrollQLParser.SYM_COMMA, i);
  }
};

LogOpFieldsFieldsContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogOpFieldsFields(this);
  }
};

LogOpFieldsFieldsContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogOpFieldsFields(this);
  }
};

ScrollQLParser.LogOpFieldsContext = LogOpFieldsContext;

ScrollQLParser.prototype.logOpFields = function() {
  var localctx = new LogOpFieldsContext(this, this._ctx, this.state);
  this.enterRule(localctx, 34, ScrollQLParser.RULE_logOpFields);
  var _la = 0; // Token type
  try {
    this.state = 274;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.K_FIELDS:
        localctx = new LogOpFieldsFieldsContext(this, localctx);
        this.enterOuterAlt(localctx, 1);
        this.state = 256;
        this.match(ScrollQLParser.K_FIELDS);
        this.state = 257;
        localctx._fieldSpec = this.fieldSpec();
        localctx.fields.push(localctx._fieldSpec);
        this.state = 262;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        while (_la === ScrollQLParser.SYM_COMMA) {
          this.state = 258;
          this.match(ScrollQLParser.SYM_COMMA);
          this.state = 259;
          localctx._fieldSpec = this.fieldSpec();
          localctx.fields.push(localctx._fieldSpec);
          this.state = 264;
          this._errHandler.sync(this);
          _la = this._input.LA(1);
        }
        break;
      case ScrollQLParser.K_DISPLAY:
        localctx = new LogOpFieldsDisplayContext(this, localctx);
        this.enterOuterAlt(localctx, 2);
        this.state = 265;
        this.match(ScrollQLParser.K_DISPLAY);
        this.state = 266;
        localctx._fieldSpec = this.fieldSpec();
        localctx.fields.push(localctx._fieldSpec);
        this.state = 271;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        while (_la === ScrollQLParser.SYM_COMMA) {
          this.state = 267;
          this.match(ScrollQLParser.SYM_COMMA);
          this.state = 268;
          localctx._fieldSpec = this.fieldSpec();
          localctx.fields.push(localctx._fieldSpec);
          this.state = 273;
          this._errHandler.sync(this);
          _la = this._input.LA(1);
        }
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function FieldSpecContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_fieldSpec;
  this.proj = null; // AliasIdContext
  return this;
}

FieldSpecContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
FieldSpecContext.prototype.constructor = FieldSpecContext;

FieldSpecContext.prototype.expressionRoot = function() {
  return this.getTypedRuleContext(ExpressionRootContext, 0);
};

FieldSpecContext.prototype.K_AS = function() {
  return this.getToken(ScrollQLParser.K_AS, 0);
};

FieldSpecContext.prototype.aliasId = function() {
  return this.getTypedRuleContext(AliasIdContext, 0);
};

FieldSpecContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterFieldSpec(this);
  }
};

FieldSpecContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitFieldSpec(this);
  }
};

ScrollQLParser.FieldSpecContext = FieldSpecContext;

ScrollQLParser.prototype.fieldSpec = function() {
  var localctx = new FieldSpecContext(this, this._ctx, this.state);
  this.enterRule(localctx, 36, ScrollQLParser.RULE_fieldSpec);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 276;
    this.expressionRoot();
    this.state = 279;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    if (_la === ScrollQLParser.K_AS) {
      this.state = 277;
      this.match(ScrollQLParser.K_AS);
      this.state = 278;
      localctx.proj = this.aliasId();
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogOpParseContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logOpParse;
  this.field = null; // FieldIdContext
  this.anchor = null; // StringContext
  this._aliasId = null; // AliasIdContext
  this.proj = []; // of AliasIdContexts
  this.re = null; // RegexContext
  return this;
}

LogOpParseContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogOpParseContext.prototype.constructor = LogOpParseContext;

LogOpParseContext.prototype.K_PARSE = function() {
  return this.getToken(ScrollQLParser.K_PARSE, 0);
};

LogOpParseContext.prototype.K_AS = function() {
  return this.getToken(ScrollQLParser.K_AS, 0);
};

LogOpParseContext.prototype.string = function() {
  return this.getTypedRuleContext(StringContext, 0);
};

LogOpParseContext.prototype.aliasId = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(AliasIdContext);
  } else {
    return this.getTypedRuleContext(AliasIdContext, i);
  }
};

LogOpParseContext.prototype.SYM_COMMA = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_COMMA);
  } else {
    return this.getToken(ScrollQLParser.SYM_COMMA, i);
  }
};

LogOpParseContext.prototype.fieldId = function() {
  return this.getTypedRuleContext(FieldIdContext, 0);
};

LogOpParseContext.prototype.regex = function() {
  return this.getTypedRuleContext(RegexContext, 0);
};

LogOpParseContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogOpParse(this);
  }
};

LogOpParseContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogOpParse(this);
  }
};

ScrollQLParser.LogOpParseContext = LogOpParseContext;

ScrollQLParser.prototype.logOpParse = function() {
  var localctx = new LogOpParseContext(this, this._ctx, this.state);
  this.enterRule(localctx, 38, ScrollQLParser.RULE_logOpParse);
  var _la = 0; // Token type
  try {
    this.state = 300;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 30, this._ctx);
    switch (la_) {
      case 1:
        this.enterOuterAlt(localctx, 1);
        this.state = 281;
        this.match(ScrollQLParser.K_PARSE);
        this.state = 283;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        if (
          (((_la - 3) & ~0x1f) == 0 &&
            ((1 << (_la - 3)) &
              ((1 << (ScrollQLParser.K_SOURCE - 3)) |
                (1 << (ScrollQLParser.K_START - 3)) |
                (1 << (ScrollQLParser.K_END - 3)) |
                (1 << (ScrollQLParser.K_NOW - 3)) |
                (1 << (ScrollQLParser.K_LIVE - 3)) |
                (1 << (ScrollQLParser.K_PARSE - 3)) |
                (1 << (ScrollQLParser.K_SEARCH - 3)) |
                (1 << (ScrollQLParser.K_FIELDS - 3)) |
                (1 << (ScrollQLParser.K_DISPLAY - 3)) |
                (1 << (ScrollQLParser.K_FILTER - 3)) |
                (1 << (ScrollQLParser.K_STATS - 3)) |
                (1 << (ScrollQLParser.K_SORT - 3)) |
                (1 << (ScrollQLParser.K_ORDER - 3)) |
                (1 << (ScrollQLParser.K_ASC - 3)) |
                (1 << (ScrollQLParser.K_DESC - 3)) |
                (1 << (ScrollQLParser.K_HEAD - 3)) |
                (1 << (ScrollQLParser.K_LIMIT - 3)) |
                (1 << (ScrollQLParser.K_TAIL - 3)) |
                (1 << (ScrollQLParser.K_REGEX - 3)) |
                (1 << (ScrollQLParser.K_IN - 3)) |
                (1 << (ScrollQLParser.K_GROUP - 3)) |
                (1 << (ScrollQLParser.K_BY - 3)) |
                (1 << (ScrollQLParser.K_AS - 3)) |
                (1 << (ScrollQLParser.K_AND - 3)) |
                (1 << (ScrollQLParser.K_OR - 3)) |
                (1 << (ScrollQLParser.K_NOT - 3)) |
                (1 << (ScrollQLParser.K_LIKE - 3)) |
                (1 << (ScrollQLParser.K_MATCHES - 3)) |
                (1 << (ScrollQLParser.K_TU_MS - 3)) |
                (1 << (ScrollQLParser.K_TU_MSEC - 3)) |
                (1 << (ScrollQLParser.K_TU_MSECOND - 3)) |
                (1 << (ScrollQLParser.K_TU_S - 3)))) !==
              0) ||
          (((_la - 35) & ~0x1f) == 0 &&
            ((1 << (_la - 35)) &
              ((1 << (ScrollQLParser.K_TU_SEC - 35)) |
                (1 << (ScrollQLParser.K_TU_SECOND - 35)) |
                (1 << (ScrollQLParser.K_TU_M - 35)) |
                (1 << (ScrollQLParser.K_TU_MIN - 35)) |
                (1 << (ScrollQLParser.K_TU_MINUTE - 35)) |
                (1 << (ScrollQLParser.K_TU_H - 35)) |
                (1 << (ScrollQLParser.K_TU_HR - 35)) |
                (1 << (ScrollQLParser.K_TU_HOUR - 35)) |
                (1 << (ScrollQLParser.K_TU_D - 35)) |
                (1 << (ScrollQLParser.K_TU_DAY - 35)) |
                (1 << (ScrollQLParser.K_TU_W - 35)) |
                (1 << (ScrollQLParser.K_TU_WEEK - 35)) |
                (1 << (ScrollQLParser.K_TU_MO - 35)) |
                (1 << (ScrollQLParser.K_TU_MON - 35)) |
                (1 << (ScrollQLParser.K_TU_MONTH - 35)) |
                (1 << (ScrollQLParser.K_TU_Q - 35)) |
                (1 << (ScrollQLParser.K_TU_QTR - 35)) |
                (1 << (ScrollQLParser.K_TU_QUARTER - 35)) |
                (1 << (ScrollQLParser.K_TU_Y - 35)) |
                (1 << (ScrollQLParser.K_TU_YR - 35)) |
                (1 << (ScrollQLParser.K_TU_YEAR - 35)) |
                (1 << (ScrollQLParser.RAW_ID - 35)) |
                (1 << (ScrollQLParser.QUOTED_IDENT - 35)) |
                (1 << (ScrollQLParser.SYM_AT - 35)))) !==
              0) ||
          (((_la - 96) & ~0x1f) == 0 &&
            ((1 << (_la - 96)) &
              ((1 << (ScrollQLParser.RE_RAW_ID - 96)) |
                (1 << (ScrollQLParser.RE_SYM_AT - 96)) |
                (1 << (ScrollQLParser.RE_QUOTED_IDENT - 96)))) !==
              0)
        ) {
          this.state = 282;
          localctx.field = this.fieldId();
        }

        this.state = 285;
        localctx.anchor = this.string();
        this.state = 286;
        this.match(ScrollQLParser.K_AS);
        this.state = 287;
        localctx._aliasId = this.aliasId();
        localctx.proj.push(localctx._aliasId);
        this.state = 292;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        while (_la === ScrollQLParser.SYM_COMMA) {
          this.state = 288;
          this.match(ScrollQLParser.SYM_COMMA);
          this.state = 289;
          localctx._aliasId = this.aliasId();
          localctx.proj.push(localctx._aliasId);
          this.state = 294;
          this._errHandler.sync(this);
          _la = this._input.LA(1);
        }
        break;

      case 2:
        this.enterOuterAlt(localctx, 2);
        this.state = 295;
        this.match(ScrollQLParser.K_PARSE);
        this.state = 297;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        if (
          (((_la - 3) & ~0x1f) == 0 &&
            ((1 << (_la - 3)) &
              ((1 << (ScrollQLParser.K_SOURCE - 3)) |
                (1 << (ScrollQLParser.K_START - 3)) |
                (1 << (ScrollQLParser.K_END - 3)) |
                (1 << (ScrollQLParser.K_NOW - 3)) |
                (1 << (ScrollQLParser.K_LIVE - 3)) |
                (1 << (ScrollQLParser.K_PARSE - 3)) |
                (1 << (ScrollQLParser.K_SEARCH - 3)) |
                (1 << (ScrollQLParser.K_FIELDS - 3)) |
                (1 << (ScrollQLParser.K_DISPLAY - 3)) |
                (1 << (ScrollQLParser.K_FILTER - 3)) |
                (1 << (ScrollQLParser.K_STATS - 3)) |
                (1 << (ScrollQLParser.K_SORT - 3)) |
                (1 << (ScrollQLParser.K_ORDER - 3)) |
                (1 << (ScrollQLParser.K_ASC - 3)) |
                (1 << (ScrollQLParser.K_DESC - 3)) |
                (1 << (ScrollQLParser.K_HEAD - 3)) |
                (1 << (ScrollQLParser.K_LIMIT - 3)) |
                (1 << (ScrollQLParser.K_TAIL - 3)) |
                (1 << (ScrollQLParser.K_REGEX - 3)) |
                (1 << (ScrollQLParser.K_IN - 3)) |
                (1 << (ScrollQLParser.K_GROUP - 3)) |
                (1 << (ScrollQLParser.K_BY - 3)) |
                (1 << (ScrollQLParser.K_AS - 3)) |
                (1 << (ScrollQLParser.K_AND - 3)) |
                (1 << (ScrollQLParser.K_OR - 3)) |
                (1 << (ScrollQLParser.K_NOT - 3)) |
                (1 << (ScrollQLParser.K_LIKE - 3)) |
                (1 << (ScrollQLParser.K_MATCHES - 3)) |
                (1 << (ScrollQLParser.K_TU_MS - 3)) |
                (1 << (ScrollQLParser.K_TU_MSEC - 3)) |
                (1 << (ScrollQLParser.K_TU_MSECOND - 3)) |
                (1 << (ScrollQLParser.K_TU_S - 3)))) !==
              0) ||
          (((_la - 35) & ~0x1f) == 0 &&
            ((1 << (_la - 35)) &
              ((1 << (ScrollQLParser.K_TU_SEC - 35)) |
                (1 << (ScrollQLParser.K_TU_SECOND - 35)) |
                (1 << (ScrollQLParser.K_TU_M - 35)) |
                (1 << (ScrollQLParser.K_TU_MIN - 35)) |
                (1 << (ScrollQLParser.K_TU_MINUTE - 35)) |
                (1 << (ScrollQLParser.K_TU_H - 35)) |
                (1 << (ScrollQLParser.K_TU_HR - 35)) |
                (1 << (ScrollQLParser.K_TU_HOUR - 35)) |
                (1 << (ScrollQLParser.K_TU_D - 35)) |
                (1 << (ScrollQLParser.K_TU_DAY - 35)) |
                (1 << (ScrollQLParser.K_TU_W - 35)) |
                (1 << (ScrollQLParser.K_TU_WEEK - 35)) |
                (1 << (ScrollQLParser.K_TU_MO - 35)) |
                (1 << (ScrollQLParser.K_TU_MON - 35)) |
                (1 << (ScrollQLParser.K_TU_MONTH - 35)) |
                (1 << (ScrollQLParser.K_TU_Q - 35)) |
                (1 << (ScrollQLParser.K_TU_QTR - 35)) |
                (1 << (ScrollQLParser.K_TU_QUARTER - 35)) |
                (1 << (ScrollQLParser.K_TU_Y - 35)) |
                (1 << (ScrollQLParser.K_TU_YR - 35)) |
                (1 << (ScrollQLParser.K_TU_YEAR - 35)) |
                (1 << (ScrollQLParser.RAW_ID - 35)) |
                (1 << (ScrollQLParser.QUOTED_IDENT - 35)) |
                (1 << (ScrollQLParser.SYM_AT - 35)))) !==
              0) ||
          (((_la - 96) & ~0x1f) == 0 &&
            ((1 << (_la - 96)) &
              ((1 << (ScrollQLParser.RE_RAW_ID - 96)) |
                (1 << (ScrollQLParser.RE_SYM_AT - 96)) |
                (1 << (ScrollQLParser.RE_QUOTED_IDENT - 96)))) !==
              0)
        ) {
          this.state = 296;
          localctx.field = this.fieldId();
        }

        this.state = 299;
        localctx.re = this.regex();
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogOpSearchContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logOpSearch;
  return this;
}

LogOpSearchContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogOpSearchContext.prototype.constructor = LogOpSearchContext;

LogOpSearchContext.prototype.K_SEARCH = function() {
  return this.getToken(ScrollQLParser.K_SEARCH, 0);
};

LogOpSearchContext.prototype.searchExpr = function() {
  return this.getTypedRuleContext(SearchExprContext, 0);
};

LogOpSearchContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogOpSearch(this);
  }
};

LogOpSearchContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogOpSearch(this);
  }
};

ScrollQLParser.LogOpSearchContext = LogOpSearchContext;

ScrollQLParser.prototype.logOpSearch = function() {
  var localctx = new LogOpSearchContext(this, this._ctx, this.state);
  this.enterRule(localctx, 40, ScrollQLParser.RULE_logOpSearch);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 302;
    this.match(ScrollQLParser.K_SEARCH);
    this.state = 303;
    this.searchExpr(0);
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function ImplicitLogOpSearchContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_implicitLogOpSearch;
  return this;
}

ImplicitLogOpSearchContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
ImplicitLogOpSearchContext.prototype.constructor = ImplicitLogOpSearchContext;

ImplicitLogOpSearchContext.prototype.searchExpr = function() {
  return this.getTypedRuleContext(SearchExprContext, 0);
};

ImplicitLogOpSearchContext.prototype.SE_K_SEARCH = function() {
  return this.getToken(ScrollQLParser.SE_K_SEARCH, 0);
};

ImplicitLogOpSearchContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterImplicitLogOpSearch(this);
  }
};

ImplicitLogOpSearchContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitImplicitLogOpSearch(this);
  }
};

ScrollQLParser.ImplicitLogOpSearchContext = ImplicitLogOpSearchContext;

ScrollQLParser.prototype.implicitLogOpSearch = function() {
  var localctx = new ImplicitLogOpSearchContext(this, this._ctx, this.state);
  this.enterRule(localctx, 42, ScrollQLParser.RULE_implicitLogOpSearch);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 306;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    if (_la === ScrollQLParser.SE_K_SEARCH) {
      this.state = 305;
      this.match(ScrollQLParser.SE_K_SEARCH);
    }

    this.state = 308;
    this.searchExpr(0);
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function SearchExprContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_searchExpr;
  return this;
}

SearchExprContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
SearchExprContext.prototype.constructor = SearchExprContext;

SearchExprContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function SearchExprTermContext(parser, ctx) {
  SearchExprContext.call(this, parser);
  this.t = null; // SearchTermContext;
  SearchExprContext.prototype.copyFrom.call(this, ctx);
  return this;
}

SearchExprTermContext.prototype = Object.create(SearchExprContext.prototype);
SearchExprTermContext.prototype.constructor = SearchExprTermContext;

ScrollQLParser.SearchExprTermContext = SearchExprTermContext;

SearchExprTermContext.prototype.searchTerm = function() {
  return this.getTypedRuleContext(SearchTermContext, 0);
};
SearchExprTermContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterSearchExprTerm(this);
  }
};

SearchExprTermContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitSearchExprTerm(this);
  }
};

function SearchExprNotContext(parser, ctx) {
  SearchExprContext.call(this, parser);
  SearchExprContext.prototype.copyFrom.call(this, ctx);
  return this;
}

SearchExprNotContext.prototype = Object.create(SearchExprContext.prototype);
SearchExprNotContext.prototype.constructor = SearchExprNotContext;

ScrollQLParser.SearchExprNotContext = SearchExprNotContext;

SearchExprNotContext.prototype.SE_K_NOT = function() {
  return this.getToken(ScrollQLParser.SE_K_NOT, 0);
};

SearchExprNotContext.prototype.searchExpr = function() {
  return this.getTypedRuleContext(SearchExprContext, 0);
};
SearchExprNotContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterSearchExprNot(this);
  }
};

SearchExprNotContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitSearchExprNot(this);
  }
};

function SearchExprAndContext(parser, ctx) {
  SearchExprContext.call(this, parser);
  SearchExprContext.prototype.copyFrom.call(this, ctx);
  return this;
}

SearchExprAndContext.prototype = Object.create(SearchExprContext.prototype);
SearchExprAndContext.prototype.constructor = SearchExprAndContext;

ScrollQLParser.SearchExprAndContext = SearchExprAndContext;

SearchExprAndContext.prototype.searchExpr = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(SearchExprContext);
  } else {
    return this.getTypedRuleContext(SearchExprContext, i);
  }
};

SearchExprAndContext.prototype.SE_K_AND = function() {
  return this.getToken(ScrollQLParser.SE_K_AND, 0);
};
SearchExprAndContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterSearchExprAnd(this);
  }
};

SearchExprAndContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitSearchExprAnd(this);
  }
};

function SearchExprNestedContext(parser, ctx) {
  SearchExprContext.call(this, parser);
  SearchExprContext.prototype.copyFrom.call(this, ctx);
  return this;
}

SearchExprNestedContext.prototype = Object.create(SearchExprContext.prototype);
SearchExprNestedContext.prototype.constructor = SearchExprNestedContext;

ScrollQLParser.SearchExprNestedContext = SearchExprNestedContext;

SearchExprNestedContext.prototype.SE_SYM_LPAREN = function() {
  return this.getToken(ScrollQLParser.SE_SYM_LPAREN, 0);
};

SearchExprNestedContext.prototype.searchExpr = function() {
  return this.getTypedRuleContext(SearchExprContext, 0);
};

SearchExprNestedContext.prototype.SE_SYM_RPAREN = function() {
  return this.getToken(ScrollQLParser.SE_SYM_RPAREN, 0);
};
SearchExprNestedContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterSearchExprNested(this);
  }
};

SearchExprNestedContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitSearchExprNested(this);
  }
};

function SearchExprOrContext(parser, ctx) {
  SearchExprContext.call(this, parser);
  SearchExprContext.prototype.copyFrom.call(this, ctx);
  return this;
}

SearchExprOrContext.prototype = Object.create(SearchExprContext.prototype);
SearchExprOrContext.prototype.constructor = SearchExprOrContext;

ScrollQLParser.SearchExprOrContext = SearchExprOrContext;

SearchExprOrContext.prototype.searchExpr = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(SearchExprContext);
  } else {
    return this.getTypedRuleContext(SearchExprContext, i);
  }
};

SearchExprOrContext.prototype.SE_K_OR = function() {
  return this.getToken(ScrollQLParser.SE_K_OR, 0);
};
SearchExprOrContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterSearchExprOr(this);
  }
};

SearchExprOrContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitSearchExprOr(this);
  }
};

ScrollQLParser.prototype.searchExpr = function(_p) {
  if (_p === undefined) {
    _p = 0;
  }
  var _parentctx = this._ctx;
  var _parentState = this.state;
  var localctx = new SearchExprContext(this, this._ctx, _parentState);
  var _prevctx = localctx;
  var _startState = 44;
  this.enterRecursionRule(localctx, 44, ScrollQLParser.RULE_searchExpr, _p);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 318;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.SE_K_NOT:
        localctx = new SearchExprNotContext(this, localctx);
        this._ctx = localctx;
        _prevctx = localctx;

        this.state = 311;
        this.match(ScrollQLParser.SE_K_NOT);
        this.state = 312;
        this.searchExpr(5);
        break;
      case ScrollQLParser.SE_SYM_LPAREN:
        localctx = new SearchExprNestedContext(this, localctx);
        this._ctx = localctx;
        _prevctx = localctx;
        this.state = 313;
        this.match(ScrollQLParser.SE_SYM_LPAREN);
        this.state = 314;
        this.searchExpr(0);
        this.state = 315;
        this.match(ScrollQLParser.SE_SYM_RPAREN);
        break;
      case ScrollQLParser.SE_SDQUOTED_STRING:
      case ScrollQLParser.SE_SSQUOTED_STRING:
      case ScrollQLParser.SE_CDQUOTED_STRING:
      case ScrollQLParser.SE_CSQUOTED_STRING:
      case ScrollQLParser.SE_UNQUOTED_STRING:
        localctx = new SearchExprTermContext(this, localctx);
        this._ctx = localctx;
        _prevctx = localctx;
        this.state = 317;
        localctx.t = this.searchTerm();
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
    this._ctx.stop = this._input.LT(-1);
    this.state = 330;
    this._errHandler.sync(this);
    var _alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
    while (_alt != 2 && _alt != antlr4.atn.ATN.INVALID_ALT_NUMBER) {
      if (_alt === 1) {
        if (this._parseListeners !== null) {
          this.triggerExitRuleEvent();
        }
        _prevctx = localctx;
        this.state = 328;
        this._errHandler.sync(this);
        var la_ = this._interp.adaptivePredict(this._input, 34, this._ctx);
        switch (la_) {
          case 1:
            localctx = new SearchExprAndContext(this, new SearchExprContext(this, _parentctx, _parentState));
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_searchExpr);
            this.state = 320;
            if (!this.precpred(this._ctx, 3)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 3)');
            }
            this.state = 322;
            this._errHandler.sync(this);
            _la = this._input.LA(1);
            if (_la === ScrollQLParser.SE_K_AND) {
              this.state = 321;
              this.match(ScrollQLParser.SE_K_AND);
            }

            this.state = 324;
            this.searchExpr(4);
            break;

          case 2:
            localctx = new SearchExprOrContext(this, new SearchExprContext(this, _parentctx, _parentState));
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_searchExpr);
            this.state = 325;
            if (!this.precpred(this._ctx, 2)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 2)');
            }
            this.state = 326;
            this.match(ScrollQLParser.SE_K_OR);
            this.state = 327;
            this.searchExpr(3);
            break;
        }
      }
      this.state = 332;
      this._errHandler.sync(this);
      _alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
    }
  } catch (error) {
    if (error instanceof antlr4.error.RecognitionException) {
      localctx.exception = error;
      this._errHandler.reportError(this, error);
      this._errHandler.recover(this, error);
    } else {
      throw error;
    }
  } finally {
    this.unrollRecursionContexts(_parentctx);
  }
  return localctx;
};

function SearchTermContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_searchTerm;
  this.bstr = null; // Token
  this.sdqstr = null; // Token
  this.ssqstr = null; // Token
  this.cdqstr = null; // Token
  this.csqstr = null; // Token
  return this;
}

SearchTermContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
SearchTermContext.prototype.constructor = SearchTermContext;

SearchTermContext.prototype.SE_UNQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SE_UNQUOTED_STRING, 0);
};

SearchTermContext.prototype.SE_SDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SE_SDQUOTED_STRING, 0);
};

SearchTermContext.prototype.SE_SSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SE_SSQUOTED_STRING, 0);
};

SearchTermContext.prototype.SE_CDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SE_CDQUOTED_STRING, 0);
};

SearchTermContext.prototype.SE_CSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SE_CSQUOTED_STRING, 0);
};

SearchTermContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterSearchTerm(this);
  }
};

SearchTermContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitSearchTerm(this);
  }
};

ScrollQLParser.SearchTermContext = SearchTermContext;

ScrollQLParser.prototype.searchTerm = function() {
  var localctx = new SearchTermContext(this, this._ctx, this.state);
  this.enterRule(localctx, 46, ScrollQLParser.RULE_searchTerm);
  try {
    this.state = 338;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.SE_UNQUOTED_STRING:
        this.enterOuterAlt(localctx, 1);
        this.state = 333;
        localctx.bstr = this.match(ScrollQLParser.SE_UNQUOTED_STRING);
        break;
      case ScrollQLParser.SE_SDQUOTED_STRING:
        this.enterOuterAlt(localctx, 2);
        this.state = 334;
        localctx.sdqstr = this.match(ScrollQLParser.SE_SDQUOTED_STRING);
        break;
      case ScrollQLParser.SE_SSQUOTED_STRING:
        this.enterOuterAlt(localctx, 3);
        this.state = 335;
        localctx.ssqstr = this.match(ScrollQLParser.SE_SSQUOTED_STRING);
        break;
      case ScrollQLParser.SE_CDQUOTED_STRING:
        this.enterOuterAlt(localctx, 4);
        this.state = 336;
        localctx.cdqstr = this.match(ScrollQLParser.SE_CDQUOTED_STRING);
        break;
      case ScrollQLParser.SE_CSQUOTED_STRING:
        this.enterOuterAlt(localctx, 5);
        this.state = 337;
        localctx.csqstr = this.match(ScrollQLParser.SE_CSQUOTED_STRING);
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogOpFilterContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logOpFilter;
  return this;
}

LogOpFilterContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogOpFilterContext.prototype.constructor = LogOpFilterContext;

LogOpFilterContext.prototype.K_FILTER = function() {
  return this.getToken(ScrollQLParser.K_FILTER, 0);
};

LogOpFilterContext.prototype.expressionRoot = function() {
  return this.getTypedRuleContext(ExpressionRootContext, 0);
};

LogOpFilterContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogOpFilter(this);
  }
};

LogOpFilterContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogOpFilter(this);
  }
};

ScrollQLParser.LogOpFilterContext = LogOpFilterContext;

ScrollQLParser.prototype.logOpFilter = function() {
  var localctx = new LogOpFilterContext(this, this._ctx, this.state);
  this.enterRule(localctx, 48, ScrollQLParser.RULE_logOpFilter);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 340;
    this.match(ScrollQLParser.K_FILTER);
    this.state = 341;
    this.expressionRoot();
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogOpSortContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logOpSort;
  return this;
}

LogOpSortContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogOpSortContext.prototype.constructor = LogOpSortContext;

LogOpSortContext.prototype.sortExpr = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(SortExprContext);
  } else {
    return this.getTypedRuleContext(SortExprContext, i);
  }
};

LogOpSortContext.prototype.K_SORT = function() {
  return this.getToken(ScrollQLParser.K_SORT, 0);
};

LogOpSortContext.prototype.K_ORDER = function() {
  return this.getToken(ScrollQLParser.K_ORDER, 0);
};

LogOpSortContext.prototype.K_BY = function() {
  return this.getToken(ScrollQLParser.K_BY, 0);
};

LogOpSortContext.prototype.SYM_COMMA = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_COMMA);
  } else {
    return this.getToken(ScrollQLParser.SYM_COMMA, i);
  }
};

LogOpSortContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogOpSort(this);
  }
};

LogOpSortContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogOpSort(this);
  }
};

ScrollQLParser.LogOpSortContext = LogOpSortContext;

ScrollQLParser.prototype.logOpSort = function() {
  var localctx = new LogOpSortContext(this, this._ctx, this.state);
  this.enterRule(localctx, 50, ScrollQLParser.RULE_logOpSort);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 343;
    _la = this._input.LA(1);
    if (!(_la === ScrollQLParser.K_SORT || _la === ScrollQLParser.K_ORDER)) {
      this._errHandler.recoverInline(this);
    } else {
      this._errHandler.reportMatch(this);
      this.consume();
    }
    this.state = 345;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 37, this._ctx);
    if (la_ === 1) {
      this.state = 344;
      this.match(ScrollQLParser.K_BY);
    }
    this.state = 347;
    this.sortExpr();
    this.state = 352;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    while (_la === ScrollQLParser.SYM_COMMA) {
      this.state = 348;
      this.match(ScrollQLParser.SYM_COMMA);
      this.state = 349;
      this.sortExpr();
      this.state = 354;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function SortExprContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_sortExpr;
  return this;
}

SortExprContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
SortExprContext.prototype.constructor = SortExprContext;

SortExprContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function SortExprDescContext(parser, ctx) {
  SortExprContext.call(this, parser);
  this.did = null; // FieldIdContext;
  SortExprContext.prototype.copyFrom.call(this, ctx);
  return this;
}

SortExprDescContext.prototype = Object.create(SortExprContext.prototype);
SortExprDescContext.prototype.constructor = SortExprDescContext;

ScrollQLParser.SortExprDescContext = SortExprDescContext;

SortExprDescContext.prototype.K_DESC = function() {
  return this.getToken(ScrollQLParser.K_DESC, 0);
};

SortExprDescContext.prototype.fieldId = function() {
  return this.getTypedRuleContext(FieldIdContext, 0);
};
SortExprDescContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterSortExprDesc(this);
  }
};

SortExprDescContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitSortExprDesc(this);
  }
};

function SortExprAscContext(parser, ctx) {
  SortExprContext.call(this, parser);
  this.aid = null; // FieldIdContext;
  SortExprContext.prototype.copyFrom.call(this, ctx);
  return this;
}

SortExprAscContext.prototype = Object.create(SortExprContext.prototype);
SortExprAscContext.prototype.constructor = SortExprAscContext;

ScrollQLParser.SortExprAscContext = SortExprAscContext;

SortExprAscContext.prototype.fieldId = function() {
  return this.getTypedRuleContext(FieldIdContext, 0);
};

SortExprAscContext.prototype.K_ASC = function() {
  return this.getToken(ScrollQLParser.K_ASC, 0);
};
SortExprAscContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterSortExprAsc(this);
  }
};

SortExprAscContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitSortExprAsc(this);
  }
};

ScrollQLParser.SortExprContext = SortExprContext;

ScrollQLParser.prototype.sortExpr = function() {
  var localctx = new SortExprContext(this, this._ctx, this.state);
  this.enterRule(localctx, 52, ScrollQLParser.RULE_sortExpr);
  var _la = 0; // Token type
  try {
    this.state = 362;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 40, this._ctx);
    switch (la_) {
      case 1:
        localctx = new SortExprDescContext(this, localctx);
        this.enterOuterAlt(localctx, 1);
        this.state = 355;
        localctx.did = this.fieldId();
        this.state = 356;
        this.match(ScrollQLParser.K_DESC);
        break;

      case 2:
        localctx = new SortExprAscContext(this, localctx);
        this.enterOuterAlt(localctx, 2);
        this.state = 358;
        localctx.aid = this.fieldId();
        this.state = 360;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        if (_la === ScrollQLParser.K_ASC) {
          this.state = 359;
          this.match(ScrollQLParser.K_ASC);
        }

        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogOpLimitContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logOpLimit;
  return this;
}

LogOpLimitContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogOpLimitContext.prototype.constructor = LogOpLimitContext;

LogOpLimitContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function LogOpLimitHeadContext(parser, ctx) {
  LogOpLimitContext.call(this, parser);
  this.n = null; // Token;
  LogOpLimitContext.prototype.copyFrom.call(this, ctx);
  return this;
}

LogOpLimitHeadContext.prototype = Object.create(LogOpLimitContext.prototype);
LogOpLimitHeadContext.prototype.constructor = LogOpLimitHeadContext;

ScrollQLParser.LogOpLimitHeadContext = LogOpLimitHeadContext;

LogOpLimitHeadContext.prototype.K_LIMIT = function() {
  return this.getToken(ScrollQLParser.K_LIMIT, 0);
};

LogOpLimitHeadContext.prototype.K_HEAD = function() {
  return this.getToken(ScrollQLParser.K_HEAD, 0);
};

LogOpLimitHeadContext.prototype.LIT_INTEGER = function() {
  return this.getToken(ScrollQLParser.LIT_INTEGER, 0);
};
LogOpLimitHeadContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogOpLimitHead(this);
  }
};

LogOpLimitHeadContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogOpLimitHead(this);
  }
};

function LogOpLimitTailContext(parser, ctx) {
  LogOpLimitContext.call(this, parser);
  this.n = null; // Token;
  LogOpLimitContext.prototype.copyFrom.call(this, ctx);
  return this;
}

LogOpLimitTailContext.prototype = Object.create(LogOpLimitContext.prototype);
LogOpLimitTailContext.prototype.constructor = LogOpLimitTailContext;

ScrollQLParser.LogOpLimitTailContext = LogOpLimitTailContext;

LogOpLimitTailContext.prototype.K_TAIL = function() {
  return this.getToken(ScrollQLParser.K_TAIL, 0);
};

LogOpLimitTailContext.prototype.LIT_INTEGER = function() {
  return this.getToken(ScrollQLParser.LIT_INTEGER, 0);
};
LogOpLimitTailContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogOpLimitTail(this);
  }
};

LogOpLimitTailContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogOpLimitTail(this);
  }
};

ScrollQLParser.LogOpLimitContext = LogOpLimitContext;

ScrollQLParser.prototype.logOpLimit = function() {
  var localctx = new LogOpLimitContext(this, this._ctx, this.state);
  this.enterRule(localctx, 54, ScrollQLParser.RULE_logOpLimit);
  var _la = 0; // Token type
  try {
    this.state = 368;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.K_HEAD:
      case ScrollQLParser.K_LIMIT:
        localctx = new LogOpLimitHeadContext(this, localctx);
        this.enterOuterAlt(localctx, 1);
        this.state = 364;
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.K_HEAD || _la === ScrollQLParser.K_LIMIT)) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        this.state = 365;
        localctx.n = this.match(ScrollQLParser.LIT_INTEGER);
        break;
      case ScrollQLParser.K_TAIL:
        localctx = new LogOpLimitTailContext(this, localctx);
        this.enterOuterAlt(localctx, 2);
        this.state = 366;
        this.match(ScrollQLParser.K_TAIL);
        this.state = 367;
        localctx.n = this.match(ScrollQLParser.LIT_INTEGER);
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function ExpressionRootContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_expressionRoot;
  return this;
}

ExpressionRootContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
ExpressionRootContext.prototype.constructor = ExpressionRootContext;

ExpressionRootContext.prototype.expression = function() {
  return this.getTypedRuleContext(ExpressionContext, 0);
};

ExpressionRootContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionRoot(this);
  }
};

ExpressionRootContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionRoot(this);
  }
};

ScrollQLParser.ExpressionRootContext = ExpressionRootContext;

ScrollQLParser.prototype.expressionRoot = function() {
  var localctx = new ExpressionRootContext(this, this._ctx, this.state);
  this.enterRule(localctx, 56, ScrollQLParser.RULE_expressionRoot);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 370;
    this.expression(0);
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function ExpressionContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_expression;
  return this;
}

ExpressionContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
ExpressionContext.prototype.constructor = ExpressionContext;

ExpressionContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function ExpressionAddSubContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  this.bop = null; // Token;
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionAddSubContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionAddSubContext.prototype.constructor = ExpressionAddSubContext;

ScrollQLParser.ExpressionAddSubContext = ExpressionAddSubContext;

ExpressionAddSubContext.prototype.expression = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(ExpressionContext);
  } else {
    return this.getTypedRuleContext(ExpressionContext, i);
  }
};

ExpressionAddSubContext.prototype.SYM_PLUS = function() {
  return this.getToken(ScrollQLParser.SYM_PLUS, 0);
};

ExpressionAddSubContext.prototype.SYM_MINUS = function() {
  return this.getToken(ScrollQLParser.SYM_MINUS, 0);
};
ExpressionAddSubContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionAddSub(this);
  }
};

ExpressionAddSubContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionAddSub(this);
  }
};

function ExpressionEqContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  this.bop = null; // Token;
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionEqContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionEqContext.prototype.constructor = ExpressionEqContext;

ScrollQLParser.ExpressionEqContext = ExpressionEqContext;

ExpressionEqContext.prototype.expression = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(ExpressionContext);
  } else {
    return this.getTypedRuleContext(ExpressionContext, i);
  }
};

ExpressionEqContext.prototype.SYM_EQ = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_EQ);
  } else {
    return this.getToken(ScrollQLParser.SYM_EQ, i);
  }
};

ExpressionEqContext.prototype.SYM_NEQ = function() {
  return this.getToken(ScrollQLParser.SYM_NEQ, 0);
};
ExpressionEqContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionEq(this);
  }
};

ExpressionEqContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionEq(this);
  }
};

function ExpressionCompContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  this.bop = null; // Token;
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionCompContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionCompContext.prototype.constructor = ExpressionCompContext;

ScrollQLParser.ExpressionCompContext = ExpressionCompContext;

ExpressionCompContext.prototype.expression = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(ExpressionContext);
  } else {
    return this.getTypedRuleContext(ExpressionContext, i);
  }
};

ExpressionCompContext.prototype.SYM_LTEQ = function() {
  return this.getToken(ScrollQLParser.SYM_LTEQ, 0);
};

ExpressionCompContext.prototype.SYM_GTEQ = function() {
  return this.getToken(ScrollQLParser.SYM_GTEQ, 0);
};

ExpressionCompContext.prototype.SYM_GT = function() {
  return this.getToken(ScrollQLParser.SYM_GT, 0);
};

ExpressionCompContext.prototype.SYM_LT = function() {
  return this.getToken(ScrollQLParser.SYM_LT, 0);
};
ExpressionCompContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionComp(this);
  }
};

ExpressionCompContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionComp(this);
  }
};

function ExpressionExpoContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionExpoContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionExpoContext.prototype.constructor = ExpressionExpoContext;

ScrollQLParser.ExpressionExpoContext = ExpressionExpoContext;

ExpressionExpoContext.prototype.expression = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(ExpressionContext);
  } else {
    return this.getTypedRuleContext(ExpressionContext, i);
  }
};

ExpressionExpoContext.prototype.SYM_CARET = function() {
  return this.getToken(ScrollQLParser.SYM_CARET, 0);
};
ExpressionExpoContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionExpo(this);
  }
};

ExpressionExpoContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionExpo(this);
  }
};

function ExpressionLikeContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  this.not = null; // Token;
  this.rhs = null; // LikeTermContext;
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionLikeContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionLikeContext.prototype.constructor = ExpressionLikeContext;

ScrollQLParser.ExpressionLikeContext = ExpressionLikeContext;

ExpressionLikeContext.prototype.expression = function() {
  return this.getTypedRuleContext(ExpressionContext, 0);
};

ExpressionLikeContext.prototype.K_LIKE = function() {
  return this.getToken(ScrollQLParser.K_LIKE, 0);
};

ExpressionLikeContext.prototype.SYM_EQTILDE = function() {
  return this.getToken(ScrollQLParser.SYM_EQTILDE, 0);
};

ExpressionLikeContext.prototype.SYM_TILDEEQ = function() {
  return this.getToken(ScrollQLParser.SYM_TILDEEQ, 0);
};

ExpressionLikeContext.prototype.likeTerm = function() {
  return this.getTypedRuleContext(LikeTermContext, 0);
};

ExpressionLikeContext.prototype.K_NOT = function() {
  return this.getToken(ScrollQLParser.K_NOT, 0);
};
ExpressionLikeContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionLike(this);
  }
};

ExpressionLikeContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionLike(this);
  }
};

function ExpressionTermContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionTermContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionTermContext.prototype.constructor = ExpressionTermContext;

ScrollQLParser.ExpressionTermContext = ExpressionTermContext;

ExpressionTermContext.prototype.term = function() {
  return this.getTypedRuleContext(TermContext, 0);
};
ExpressionTermContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionTerm(this);
  }
};

ExpressionTermContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionTerm(this);
  }
};

function ExpressionNegContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionNegContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionNegContext.prototype.constructor = ExpressionNegContext;

ScrollQLParser.ExpressionNegContext = ExpressionNegContext;

ExpressionNegContext.prototype.SYM_MINUS = function() {
  return this.getToken(ScrollQLParser.SYM_MINUS, 0);
};

ExpressionNegContext.prototype.expression = function() {
  return this.getTypedRuleContext(ExpressionContext, 0);
};
ExpressionNegContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionNeg(this);
  }
};

ExpressionNegContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionNeg(this);
  }
};

function ExpressionNotContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionNotContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionNotContext.prototype.constructor = ExpressionNotContext;

ScrollQLParser.ExpressionNotContext = ExpressionNotContext;

ExpressionNotContext.prototype.expression = function() {
  return this.getTypedRuleContext(ExpressionContext, 0);
};

ExpressionNotContext.prototype.SYM_NOT = function() {
  return this.getToken(ScrollQLParser.SYM_NOT, 0);
};

ExpressionNotContext.prototype.K_NOT = function() {
  return this.getToken(ScrollQLParser.K_NOT, 0);
};
ExpressionNotContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionNot(this);
  }
};

ExpressionNotContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionNot(this);
  }
};

function ExpressionPosContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionPosContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionPosContext.prototype.constructor = ExpressionPosContext;

ScrollQLParser.ExpressionPosContext = ExpressionPosContext;

ExpressionPosContext.prototype.SYM_PLUS = function() {
  return this.getToken(ScrollQLParser.SYM_PLUS, 0);
};

ExpressionPosContext.prototype.expression = function() {
  return this.getTypedRuleContext(ExpressionContext, 0);
};
ExpressionPosContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionPos(this);
  }
};

ExpressionPosContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionPos(this);
  }
};

function ExpressionMulDivModContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  this.bop = null; // Token;
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionMulDivModContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionMulDivModContext.prototype.constructor = ExpressionMulDivModContext;

ScrollQLParser.ExpressionMulDivModContext = ExpressionMulDivModContext;

ExpressionMulDivModContext.prototype.expression = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(ExpressionContext);
  } else {
    return this.getTypedRuleContext(ExpressionContext, i);
  }
};

ExpressionMulDivModContext.prototype.SYM_MUL = function() {
  return this.getToken(ScrollQLParser.SYM_MUL, 0);
};

ExpressionMulDivModContext.prototype.SYM_DIV = function() {
  return this.getToken(ScrollQLParser.SYM_DIV, 0);
};

ExpressionMulDivModContext.prototype.SYM_MOD = function() {
  return this.getToken(ScrollQLParser.SYM_MOD, 0);
};
ExpressionMulDivModContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionMulDivMod(this);
  }
};

ExpressionMulDivModContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionMulDivMod(this);
  }
};

function ExpressionAndContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  this.lhs = null; // ExpressionContext;
  this.rhs = null; // ExpressionContext;
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionAndContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionAndContext.prototype.constructor = ExpressionAndContext;

ScrollQLParser.ExpressionAndContext = ExpressionAndContext;

ExpressionAndContext.prototype.K_AND = function() {
  return this.getToken(ScrollQLParser.K_AND, 0);
};

ExpressionAndContext.prototype.expression = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(ExpressionContext);
  } else {
    return this.getTypedRuleContext(ExpressionContext, i);
  }
};
ExpressionAndContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionAnd(this);
  }
};

ExpressionAndContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionAnd(this);
  }
};

function ExpressionNestedContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionNestedContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionNestedContext.prototype.constructor = ExpressionNestedContext;

ScrollQLParser.ExpressionNestedContext = ExpressionNestedContext;

ExpressionNestedContext.prototype.SYM_LPAREN = function() {
  return this.getToken(ScrollQLParser.SYM_LPAREN, 0);
};

ExpressionNestedContext.prototype.expression = function() {
  return this.getTypedRuleContext(ExpressionContext, 0);
};

ExpressionNestedContext.prototype.SYM_RPAREN = function() {
  return this.getToken(ScrollQLParser.SYM_RPAREN, 0);
};
ExpressionNestedContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionNested(this);
  }
};

ExpressionNestedContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionNested(this);
  }
};

function ExpressionOrContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  this.lhs = null; // ExpressionContext;
  this.rhs = null; // ExpressionContext;
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionOrContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionOrContext.prototype.constructor = ExpressionOrContext;

ScrollQLParser.ExpressionOrContext = ExpressionOrContext;

ExpressionOrContext.prototype.K_OR = function() {
  return this.getToken(ScrollQLParser.K_OR, 0);
};

ExpressionOrContext.prototype.expression = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(ExpressionContext);
  } else {
    return this.getTypedRuleContext(ExpressionContext, i);
  }
};
ExpressionOrContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionOr(this);
  }
};

ExpressionOrContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionOr(this);
  }
};

function ExpressionInContext(parser, ctx) {
  ExpressionContext.call(this, parser);
  this.lhs = null; // ExpressionContext;
  this.not = null; // Token;
  this.rhs = null; // ArrayContext;
  ExpressionContext.prototype.copyFrom.call(this, ctx);
  return this;
}

ExpressionInContext.prototype = Object.create(ExpressionContext.prototype);
ExpressionInContext.prototype.constructor = ExpressionInContext;

ScrollQLParser.ExpressionInContext = ExpressionInContext;

ExpressionInContext.prototype.K_IN = function() {
  return this.getToken(ScrollQLParser.K_IN, 0);
};

ExpressionInContext.prototype.expression = function() {
  return this.getTypedRuleContext(ExpressionContext, 0);
};

ExpressionInContext.prototype.array = function() {
  return this.getTypedRuleContext(ArrayContext, 0);
};

ExpressionInContext.prototype.K_NOT = function() {
  return this.getToken(ScrollQLParser.K_NOT, 0);
};
ExpressionInContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterExpressionIn(this);
  }
};

ExpressionInContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitExpressionIn(this);
  }
};

ScrollQLParser.prototype.expression = function(_p) {
  if (_p === undefined) {
    _p = 0;
  }
  var _parentctx = this._ctx;
  var _parentState = this.state;
  var localctx = new ExpressionContext(this, this._ctx, _parentState);
  var _prevctx = localctx;
  var _startState = 58;
  this.enterRecursionRule(localctx, 58, ScrollQLParser.RULE_expression, _p);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 384;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 42, this._ctx);
    switch (la_) {
      case 1:
        localctx = new ExpressionNestedContext(this, localctx);
        this._ctx = localctx;
        _prevctx = localctx;

        this.state = 373;
        this.match(ScrollQLParser.SYM_LPAREN);
        this.state = 374;
        this.expression(0);
        this.state = 375;
        this.match(ScrollQLParser.SYM_RPAREN);
        break;

      case 2:
        localctx = new ExpressionNotContext(this, localctx);
        this._ctx = localctx;
        _prevctx = localctx;
        this.state = 377;
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.K_NOT || _la === ScrollQLParser.SYM_NOT)) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        this.state = 378;
        this.expression(12);
        break;

      case 3:
        localctx = new ExpressionNegContext(this, localctx);
        this._ctx = localctx;
        _prevctx = localctx;
        this.state = 379;
        this.match(ScrollQLParser.SYM_MINUS);
        this.state = 380;
        this.expression(11);
        break;

      case 4:
        localctx = new ExpressionPosContext(this, localctx);
        this._ctx = localctx;
        _prevctx = localctx;
        this.state = 381;
        this.match(ScrollQLParser.SYM_PLUS);
        this.state = 382;
        this.expression(10);
        break;

      case 5:
        localctx = new ExpressionTermContext(this, localctx);
        this._ctx = localctx;
        _prevctx = localctx;
        this.state = 383;
        this.term();
        break;
    }
    this._ctx.stop = this._input.LT(-1);
    this.state = 426;
    this._errHandler.sync(this);
    var _alt = this._interp.adaptivePredict(this._input, 47, this._ctx);
    while (_alt != 2 && _alt != antlr4.atn.ATN.INVALID_ALT_NUMBER) {
      if (_alt === 1) {
        if (this._parseListeners !== null) {
          this.triggerExitRuleEvent();
        }
        _prevctx = localctx;
        this.state = 424;
        this._errHandler.sync(this);
        var la_ = this._interp.adaptivePredict(this._input, 46, this._ctx);
        switch (la_) {
          case 1:
            localctx = new ExpressionExpoContext(this, new ExpressionContext(this, _parentctx, _parentState));
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_expression);
            this.state = 386;
            if (!this.precpred(this._ctx, 13)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 13)');
            }
            this.state = 387;
            this.match(ScrollQLParser.SYM_CARET);
            this.state = 388;
            this.expression(13);
            break;

          case 2:
            localctx = new ExpressionMulDivModContext(this, new ExpressionContext(this, _parentctx, _parentState));
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_expression);
            this.state = 389;
            if (!this.precpred(this._ctx, 9)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 9)');
            }
            this.state = 390;
            localctx.bop = this._input.LT(1);
            _la = this._input.LA(1);
            if (
              !(
                ((_la - 75) & ~0x1f) == 0 &&
                ((1 << (_la - 75)) &
                  ((1 << (ScrollQLParser.SYM_MUL - 75)) |
                    (1 << (ScrollQLParser.SYM_DIV - 75)) |
                    (1 << (ScrollQLParser.SYM_MOD - 75)))) !==
                  0
              )
            ) {
              localctx.bop = this._errHandler.recoverInline(this);
            } else {
              this._errHandler.reportMatch(this);
              this.consume();
            }
            this.state = 391;
            this.expression(10);
            break;

          case 3:
            localctx = new ExpressionAddSubContext(this, new ExpressionContext(this, _parentctx, _parentState));
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_expression);
            this.state = 392;
            if (!this.precpred(this._ctx, 8)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 8)');
            }
            this.state = 393;
            localctx.bop = this._input.LT(1);
            _la = this._input.LA(1);
            if (!(_la === ScrollQLParser.SYM_PLUS || _la === ScrollQLParser.SYM_MINUS)) {
              localctx.bop = this._errHandler.recoverInline(this);
            } else {
              this._errHandler.reportMatch(this);
              this.consume();
            }
            this.state = 394;
            this.expression(9);
            break;

          case 4:
            localctx = new ExpressionCompContext(this, new ExpressionContext(this, _parentctx, _parentState));
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_expression);
            this.state = 395;
            if (!this.precpred(this._ctx, 7)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 7)');
            }
            this.state = 396;
            localctx.bop = this._input.LT(1);
            _la = this._input.LA(1);
            if (
              !(
                ((_la - 81) & ~0x1f) == 0 &&
                ((1 << (_la - 81)) &
                  ((1 << (ScrollQLParser.SYM_LT - 81)) |
                    (1 << (ScrollQLParser.SYM_GT - 81)) |
                    (1 << (ScrollQLParser.SYM_LTEQ - 81)) |
                    (1 << (ScrollQLParser.SYM_GTEQ - 81)))) !==
                  0
              )
            ) {
              localctx.bop = this._errHandler.recoverInline(this);
            } else {
              this._errHandler.reportMatch(this);
              this.consume();
            }
            this.state = 397;
            this.expression(8);
            break;

          case 5:
            localctx = new ExpressionEqContext(this, new ExpressionContext(this, _parentctx, _parentState));
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_expression);
            this.state = 398;
            if (!this.precpred(this._ctx, 6)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 6)');
            }
            this.state = 403;
            this._errHandler.sync(this);
            var la_ = this._interp.adaptivePredict(this._input, 43, this._ctx);
            switch (la_) {
              case 1:
                this.state = 399;
                localctx.bop = this.match(ScrollQLParser.SYM_EQ);
                this.state = 400;
                this.match(ScrollQLParser.SYM_EQ);
                break;

              case 2:
                this.state = 401;
                localctx.bop = this.match(ScrollQLParser.SYM_EQ);
                break;

              case 3:
                this.state = 402;
                localctx.bop = this.match(ScrollQLParser.SYM_NEQ);
                break;
            }
            this.state = 405;
            this.expression(7);
            break;

          case 6:
            localctx = new ExpressionAndContext(this, new ExpressionContext(this, _parentctx, _parentState));
            localctx.lhs = _prevctx;
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_expression);
            this.state = 406;
            if (!this.precpred(this._ctx, 3)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 3)');
            }
            this.state = 407;
            this.match(ScrollQLParser.K_AND);
            this.state = 408;
            localctx.rhs = this.expression(4);
            break;

          case 7:
            localctx = new ExpressionOrContext(this, new ExpressionContext(this, _parentctx, _parentState));
            localctx.lhs = _prevctx;
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_expression);
            this.state = 409;
            if (!this.precpred(this._ctx, 2)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 2)');
            }
            this.state = 410;
            this.match(ScrollQLParser.K_OR);
            this.state = 411;
            localctx.rhs = this.expression(3);
            break;

          case 8:
            localctx = new ExpressionLikeContext(this, new ExpressionContext(this, _parentctx, _parentState));
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_expression);
            this.state = 412;
            if (!this.precpred(this._ctx, 5)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 5)');
            }
            this.state = 414;
            this._errHandler.sync(this);
            _la = this._input.LA(1);
            if (_la === ScrollQLParser.K_NOT) {
              this.state = 413;
              localctx.not = this.match(ScrollQLParser.K_NOT);
            }

            this.state = 416;
            _la = this._input.LA(1);
            if (
              !(
                _la === ScrollQLParser.K_LIKE ||
                _la === ScrollQLParser.SYM_EQTILDE ||
                _la === ScrollQLParser.SYM_TILDEEQ
              )
            ) {
              this._errHandler.recoverInline(this);
            } else {
              this._errHandler.reportMatch(this);
              this.consume();
            }
            this.state = 417;
            localctx.rhs = this.likeTerm();
            break;

          case 9:
            localctx = new ExpressionInContext(this, new ExpressionContext(this, _parentctx, _parentState));
            localctx.lhs = _prevctx;
            this.pushNewRecursionContext(localctx, _startState, ScrollQLParser.RULE_expression);
            this.state = 418;
            if (!this.precpred(this._ctx, 4)) {
              throw new antlr4.error.FailedPredicateException(this, 'this.precpred(this._ctx, 4)');
            }
            this.state = 420;
            this._errHandler.sync(this);
            _la = this._input.LA(1);
            if (_la === ScrollQLParser.K_NOT) {
              this.state = 419;
              localctx.not = this.match(ScrollQLParser.K_NOT);
            }

            this.state = 422;
            this.match(ScrollQLParser.K_IN);
            this.state = 423;
            localctx.rhs = this.array();
            break;
        }
      }
      this.state = 428;
      this._errHandler.sync(this);
      _alt = this._interp.adaptivePredict(this._input, 47, this._ctx);
    }
  } catch (error) {
    if (error instanceof antlr4.error.RecognitionException) {
      localctx.exception = error;
      this._errHandler.reportError(this, error);
      this._errHandler.recover(this, error);
    } else {
      throw error;
    }
  } finally {
    this.unrollRecursionContexts(_parentctx);
  }
  return localctx;
};

function TermContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_term;
  return this;
}

TermContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
TermContext.prototype.constructor = TermContext;

TermContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function TermStrContext(parser, ctx) {
  TermContext.call(this, parser);
  this.str = null; // StringOrBareStringContext;
  TermContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TermStrContext.prototype = Object.create(TermContext.prototype);
TermStrContext.prototype.constructor = TermStrContext;

ScrollQLParser.TermStrContext = TermStrContext;

TermStrContext.prototype.stringOrBareString = function() {
  return this.getTypedRuleContext(StringOrBareStringContext, 0);
};
TermStrContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTermStr(this);
  }
};

TermStrContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTermStr(this);
  }
};

function TermIdContext(parser, ctx) {
  TermContext.call(this, parser);
  this.fid = null; // FieldIdContext;
  TermContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TermIdContext.prototype = Object.create(TermContext.prototype);
TermIdContext.prototype.constructor = TermIdContext;

ScrollQLParser.TermIdContext = TermIdContext;

TermIdContext.prototype.fieldId = function() {
  return this.getTypedRuleContext(FieldIdContext, 0);
};
TermIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTermId(this);
  }
};

TermIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTermId(this);
  }
};

function TermFnContext(parser, ctx) {
  TermContext.call(this, parser);
  this.fn = null; // FuncContext;
  TermContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TermFnContext.prototype = Object.create(TermContext.prototype);
TermFnContext.prototype.constructor = TermFnContext;

ScrollQLParser.TermFnContext = TermFnContext;

TermFnContext.prototype.func = function() {
  return this.getTypedRuleContext(FuncContext, 0);
};
TermFnContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTermFn(this);
  }
};

TermFnContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTermFn(this);
  }
};

function TermNumContext(parser, ctx) {
  TermContext.call(this, parser);
  this.num = null; // NumberContext;
  TermContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TermNumContext.prototype = Object.create(TermContext.prototype);
TermNumContext.prototype.constructor = TermNumContext;

ScrollQLParser.TermNumContext = TermNumContext;

TermNumContext.prototype.number = function() {
  return this.getTypedRuleContext(NumberContext, 0);
};
TermNumContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTermNum(this);
  }
};

TermNumContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTermNum(this);
  }
};

ScrollQLParser.TermContext = TermContext;

ScrollQLParser.prototype.term = function() {
  var localctx = new TermContext(this, this._ctx, this.state);
  this.enterRule(localctx, 60, ScrollQLParser.RULE_term);
  try {
    this.state = 433;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 48, this._ctx);
    switch (la_) {
      case 1:
        localctx = new TermIdContext(this, localctx);
        this.enterOuterAlt(localctx, 1);
        this.state = 429;
        localctx.fid = this.fieldId();
        break;

      case 2:
        localctx = new TermNumContext(this, localctx);
        this.enterOuterAlt(localctx, 2);
        this.state = 430;
        localctx.num = this.number();
        break;

      case 3:
        localctx = new TermStrContext(this, localctx);
        this.enterOuterAlt(localctx, 3);
        this.state = 431;
        localctx.str = this.stringOrBareString();
        break;

      case 4:
        localctx = new TermFnContext(this, localctx);
        this.enterOuterAlt(localctx, 4);
        this.state = 432;
        localctx.fn = this.func();
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LikeTermContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_likeTerm;
  this.re = null; // RegexContext
  this.str = null; // RegexStringContext
  return this;
}

LikeTermContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LikeTermContext.prototype.constructor = LikeTermContext;

LikeTermContext.prototype.regex = function() {
  return this.getTypedRuleContext(RegexContext, 0);
};

LikeTermContext.prototype.regexString = function() {
  return this.getTypedRuleContext(RegexStringContext, 0);
};

LikeTermContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLikeTerm(this);
  }
};

LikeTermContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLikeTerm(this);
  }
};

ScrollQLParser.LikeTermContext = LikeTermContext;

ScrollQLParser.prototype.likeTerm = function() {
  var localctx = new LikeTermContext(this, this._ctx, this.state);
  this.enterRule(localctx, 62, ScrollQLParser.RULE_likeTerm);
  try {
    this.state = 437;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.REGEX:
        this.enterOuterAlt(localctx, 1);
        this.state = 435;
        localctx.re = this.regex();
        break;
      case ScrollQLParser.RE_SDQUOTED_STRING:
      case ScrollQLParser.RE_SSQUOTED_STRING:
      case ScrollQLParser.RE_CDQUOTED_STRING:
      case ScrollQLParser.RE_CSQUOTED_STRING:
        this.enterOuterAlt(localctx, 2);
        this.state = 436;
        localctx.str = this.regexString();
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function FuncContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_func;
  return this;
}

FuncContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
FuncContext.prototype.constructor = FuncContext;

FuncContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function FunctionWithArgsContext(parser, ctx) {
  FuncContext.call(this, parser);
  this.fun = null; // FunctionIdContext;
  this._functionArg = null; // FunctionArgContext;
  this.Args = []; // of FunctionArgContexts;
  FuncContext.prototype.copyFrom.call(this, ctx);
  return this;
}

FunctionWithArgsContext.prototype = Object.create(FuncContext.prototype);
FunctionWithArgsContext.prototype.constructor = FunctionWithArgsContext;

ScrollQLParser.FunctionWithArgsContext = FunctionWithArgsContext;

FunctionWithArgsContext.prototype.SYM_LPAREN = function() {
  return this.getToken(ScrollQLParser.SYM_LPAREN, 0);
};

FunctionWithArgsContext.prototype.SYM_RPAREN = function() {
  return this.getToken(ScrollQLParser.SYM_RPAREN, 0);
};

FunctionWithArgsContext.prototype.functionId = function() {
  return this.getTypedRuleContext(FunctionIdContext, 0);
};

FunctionWithArgsContext.prototype.functionArg = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(FunctionArgContext);
  } else {
    return this.getTypedRuleContext(FunctionArgContext, i);
  }
};

FunctionWithArgsContext.prototype.SYM_COMMA = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_COMMA);
  } else {
    return this.getToken(ScrollQLParser.SYM_COMMA, i);
  }
};

FunctionWithArgsContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterFunctionWithArgs(this);
  }
};

FunctionWithArgsContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitFunctionWithArgs(this);
  }
};

function FunctionWithNoArgsContext(parser, ctx) {
  FuncContext.call(this, parser);
  this.fun = null; // FunctionIdContext;
  FuncContext.prototype.copyFrom.call(this, ctx);
  return this;
}

FunctionWithNoArgsContext.prototype = Object.create(FuncContext.prototype);
FunctionWithNoArgsContext.prototype.constructor = FunctionWithNoArgsContext;

ScrollQLParser.FunctionWithNoArgsContext = FunctionWithNoArgsContext;

FunctionWithNoArgsContext.prototype.SYM_LPAREN = function() {
  return this.getToken(ScrollQLParser.SYM_LPAREN, 0);
};

FunctionWithNoArgsContext.prototype.SYM_RPAREN = function() {
  return this.getToken(ScrollQLParser.SYM_RPAREN, 0);
};

FunctionWithNoArgsContext.prototype.functionId = function() {
  return this.getTypedRuleContext(FunctionIdContext, 0);
};

FunctionWithNoArgsContext.prototype.SYM_MUL = function() {
  return this.getToken(ScrollQLParser.SYM_MUL, 0);
};
FunctionWithNoArgsContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterFunctionWithNoArgs(this);
  }
};

FunctionWithNoArgsContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitFunctionWithNoArgs(this);
  }
};

ScrollQLParser.FuncContext = FuncContext;

ScrollQLParser.prototype.func = function() {
  var localctx = new FuncContext(this, this._ctx, this.state);
  this.enterRule(localctx, 64, ScrollQLParser.RULE_func);
  var _la = 0; // Token type
  try {
    this.state = 458;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 52, this._ctx);
    switch (la_) {
      case 1:
        localctx = new FunctionWithArgsContext(this, localctx);
        this.enterOuterAlt(localctx, 1);
        this.state = 439;
        localctx.fun = this.functionId();
        this.state = 440;
        this.match(ScrollQLParser.SYM_LPAREN);
        this.state = 441;
        localctx._functionArg = this.functionArg();
        localctx.Args.push(localctx._functionArg);
        this.state = 446;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        while (_la === ScrollQLParser.SYM_COMMA) {
          this.state = 442;
          this.match(ScrollQLParser.SYM_COMMA);
          this.state = 443;
          localctx._functionArg = this.functionArg();
          localctx.Args.push(localctx._functionArg);
          this.state = 448;
          this._errHandler.sync(this);
          _la = this._input.LA(1);
        }
        this.state = 449;
        this.match(ScrollQLParser.SYM_RPAREN);
        break;

      case 2:
        localctx = new FunctionWithNoArgsContext(this, localctx);
        this.enterOuterAlt(localctx, 2);
        this.state = 451;
        localctx.fun = this.functionId();
        this.state = 452;
        this.match(ScrollQLParser.SYM_LPAREN);
        this.state = 454;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        if (_la === ScrollQLParser.SYM_MUL) {
          this.state = 453;
          this.match(ScrollQLParser.SYM_MUL);
        }

        this.state = 456;
        this.match(ScrollQLParser.SYM_RPAREN);
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function FunctionArgContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_functionArg;
  return this;
}

FunctionArgContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
FunctionArgContext.prototype.constructor = FunctionArgContext;

FunctionArgContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function FunctionArgFieldClauseContext(parser, ctx) {
  FunctionArgContext.call(this, parser);
  FunctionArgContext.prototype.copyFrom.call(this, ctx);
  return this;
}

FunctionArgFieldClauseContext.prototype = Object.create(FunctionArgContext.prototype);
FunctionArgFieldClauseContext.prototype.constructor = FunctionArgFieldClauseContext;

ScrollQLParser.FunctionArgFieldClauseContext = FunctionArgFieldClauseContext;

FunctionArgFieldClauseContext.prototype.expression = function() {
  return this.getTypedRuleContext(ExpressionContext, 0);
};
FunctionArgFieldClauseContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterFunctionArgFieldClause(this);
  }
};

FunctionArgFieldClauseContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitFunctionArgFieldClause(this);
  }
};

function FunctionArgTimePeriodContext(parser, ctx) {
  FunctionArgContext.call(this, parser);
  FunctionArgContext.prototype.copyFrom.call(this, ctx);
  return this;
}

FunctionArgTimePeriodContext.prototype = Object.create(FunctionArgContext.prototype);
FunctionArgTimePeriodContext.prototype.constructor = FunctionArgTimePeriodContext;

ScrollQLParser.FunctionArgTimePeriodContext = FunctionArgTimePeriodContext;

FunctionArgTimePeriodContext.prototype.relativeTimeExpr = function() {
  return this.getTypedRuleContext(RelativeTimeExprContext, 0);
};
FunctionArgTimePeriodContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterFunctionArgTimePeriod(this);
  }
};

FunctionArgTimePeriodContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitFunctionArgTimePeriod(this);
  }
};

ScrollQLParser.FunctionArgContext = FunctionArgContext;

ScrollQLParser.prototype.functionArg = function() {
  var localctx = new FunctionArgContext(this, this._ctx, this.state);
  this.enterRule(localctx, 66, ScrollQLParser.RULE_functionArg);
  try {
    this.state = 462;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 53, this._ctx);
    switch (la_) {
      case 1:
        localctx = new FunctionArgTimePeriodContext(this, localctx);
        this.enterOuterAlt(localctx, 1);
        this.state = 460;
        this.relativeTimeExpr();
        break;

      case 2:
        localctx = new FunctionArgFieldClauseContext(this, localctx);
        this.enterOuterAlt(localctx, 2);
        this.state = 461;
        this.expression(0);
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function ArrayContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_array;
  return this;
}

ArrayContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
ArrayContext.prototype.constructor = ArrayContext;

ArrayContext.prototype.SYM_LBRACKET = function() {
  return this.getToken(ScrollQLParser.SYM_LBRACKET, 0);
};

ArrayContext.prototype.arrayElem = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTypedRuleContexts(ArrayElemContext);
  } else {
    return this.getTypedRuleContext(ArrayElemContext, i);
  }
};

ArrayContext.prototype.SYM_RBRACKET = function() {
  return this.getToken(ScrollQLParser.SYM_RBRACKET, 0);
};

ArrayContext.prototype.SYM_COMMA = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_COMMA);
  } else {
    return this.getToken(ScrollQLParser.SYM_COMMA, i);
  }
};

ArrayContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterArray(this);
  }
};

ArrayContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitArray(this);
  }
};

ScrollQLParser.ArrayContext = ArrayContext;

ScrollQLParser.prototype.array = function() {
  var localctx = new ArrayContext(this, this._ctx, this.state);
  this.enterRule(localctx, 68, ScrollQLParser.RULE_array);
  var _la = 0; // Token type
  try {
    this.state = 477;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 55, this._ctx);
    switch (la_) {
      case 1:
        this.enterOuterAlt(localctx, 1);
        this.state = 464;
        this.match(ScrollQLParser.SYM_LBRACKET);
        this.state = 465;
        this.arrayElem();
        this.state = 470;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        while (_la === ScrollQLParser.SYM_COMMA) {
          this.state = 466;
          this.match(ScrollQLParser.SYM_COMMA);
          this.state = 467;
          this.arrayElem();
          this.state = 472;
          this._errHandler.sync(this);
          _la = this._input.LA(1);
        }
        this.state = 473;
        this.match(ScrollQLParser.SYM_RBRACKET);
        break;

      case 2:
        this.enterOuterAlt(localctx, 2);
        this.state = 475;
        this.match(ScrollQLParser.SYM_LBRACKET);
        this.state = 476;
        this.match(ScrollQLParser.SYM_RBRACKET);
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function ArrayElemContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_arrayElem;
  this.arrayElement = null; // StringContext
  this.num = null; // NumberContext
  return this;
}

ArrayElemContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
ArrayElemContext.prototype.constructor = ArrayElemContext;

ArrayElemContext.prototype.string = function() {
  return this.getTypedRuleContext(StringContext, 0);
};

ArrayElemContext.prototype.number = function() {
  return this.getTypedRuleContext(NumberContext, 0);
};

ArrayElemContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterArrayElem(this);
  }
};

ArrayElemContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitArrayElem(this);
  }
};

ScrollQLParser.ArrayElemContext = ArrayElemContext;

ScrollQLParser.prototype.arrayElem = function() {
  var localctx = new ArrayElemContext(this, this._ctx, this.state);
  this.enterRule(localctx, 70, ScrollQLParser.RULE_arrayElem);
  try {
    this.state = 481;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.SDQUOTED_STRING:
      case ScrollQLParser.SSQUOTED_STRING:
      case ScrollQLParser.CDQUOTED_STRING:
      case ScrollQLParser.CSQUOTED_STRING:
      case ScrollQLParser.RE_SDQUOTED_STRING:
      case ScrollQLParser.RE_SSQUOTED_STRING:
      case ScrollQLParser.RE_CDQUOTED_STRING:
      case ScrollQLParser.RE_CSQUOTED_STRING:
        this.enterOuterAlt(localctx, 1);
        this.state = 479;
        localctx.arrayElement = this.string();
        break;
      case ScrollQLParser.LIT_INTEGER:
      case ScrollQLParser.LIT_NUMBER:
        this.enterOuterAlt(localctx, 2);
        this.state = 480;
        localctx.num = this.number();
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function NumberContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_number;
  this.numF = null; // Token
  this.numI = null; // Token
  return this;
}

NumberContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
NumberContext.prototype.constructor = NumberContext;

NumberContext.prototype.LIT_NUMBER = function() {
  return this.getToken(ScrollQLParser.LIT_NUMBER, 0);
};

NumberContext.prototype.LIT_INTEGER = function() {
  return this.getToken(ScrollQLParser.LIT_INTEGER, 0);
};

NumberContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterNumber(this);
  }
};

NumberContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitNumber(this);
  }
};

ScrollQLParser.NumberContext = NumberContext;

ScrollQLParser.prototype.number = function() {
  var localctx = new NumberContext(this, this._ctx, this.state);
  this.enterRule(localctx, 72, ScrollQLParser.RULE_number);
  try {
    this.state = 485;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.LIT_NUMBER:
        this.enterOuterAlt(localctx, 1);
        this.state = 483;
        localctx.numF = this.match(ScrollQLParser.LIT_NUMBER);
        break;
      case ScrollQLParser.LIT_INTEGER:
        this.enterOuterAlt(localctx, 2);
        this.state = 484;
        localctx.numI = this.match(ScrollQLParser.LIT_INTEGER);
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function StringContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_string;
  this.sdqstr = null; // Token
  this.ssqstr = null; // Token
  this.cdqstr = null; // Token
  this.csqstr = null; // Token
  return this;
}

StringContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
StringContext.prototype.constructor = StringContext;

StringContext.prototype.SDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SDQUOTED_STRING, 0);
};

StringContext.prototype.RE_SDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_SDQUOTED_STRING, 0);
};

StringContext.prototype.SSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SSQUOTED_STRING, 0);
};

StringContext.prototype.RE_SSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_SSQUOTED_STRING, 0);
};

StringContext.prototype.CDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.CDQUOTED_STRING, 0);
};

StringContext.prototype.RE_CDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_CDQUOTED_STRING, 0);
};

StringContext.prototype.CSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.CSQUOTED_STRING, 0);
};

StringContext.prototype.RE_CSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_CSQUOTED_STRING, 0);
};

StringContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterString(this);
  }
};

StringContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitString(this);
  }
};

ScrollQLParser.StringContext = StringContext;

ScrollQLParser.prototype.string = function() {
  var localctx = new StringContext(this, this._ctx, this.state);
  this.enterRule(localctx, 74, ScrollQLParser.RULE_string);
  var _la = 0; // Token type
  try {
    this.state = 491;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.SDQUOTED_STRING:
      case ScrollQLParser.RE_SDQUOTED_STRING:
        this.enterOuterAlt(localctx, 1);
        this.state = 487;
        localctx.sdqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.SDQUOTED_STRING || _la === ScrollQLParser.RE_SDQUOTED_STRING)) {
          localctx.sdqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.SSQUOTED_STRING:
      case ScrollQLParser.RE_SSQUOTED_STRING:
        this.enterOuterAlt(localctx, 2);
        this.state = 488;
        localctx.ssqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.SSQUOTED_STRING || _la === ScrollQLParser.RE_SSQUOTED_STRING)) {
          localctx.ssqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.CDQUOTED_STRING:
      case ScrollQLParser.RE_CDQUOTED_STRING:
        this.enterOuterAlt(localctx, 3);
        this.state = 489;
        localctx.cdqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.CDQUOTED_STRING || _la === ScrollQLParser.RE_CDQUOTED_STRING)) {
          localctx.cdqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.CSQUOTED_STRING:
      case ScrollQLParser.RE_CSQUOTED_STRING:
        this.enterOuterAlt(localctx, 4);
        this.state = 490;
        localctx.csqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.CSQUOTED_STRING || _la === ScrollQLParser.RE_CSQUOTED_STRING)) {
          localctx.csqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function StringOrBareStringContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_stringOrBareString;
  this.sdqstr = null; // Token
  this.ssqstr = null; // Token
  this.cdqstr = null; // Token
  this.csqstr = null; // Token
  this.bstr = null; // Token
  return this;
}

StringOrBareStringContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
StringOrBareStringContext.prototype.constructor = StringOrBareStringContext;

StringOrBareStringContext.prototype.SDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SDQUOTED_STRING, 0);
};

StringOrBareStringContext.prototype.RE_SDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_SDQUOTED_STRING, 0);
};

StringOrBareStringContext.prototype.SSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SSQUOTED_STRING, 0);
};

StringOrBareStringContext.prototype.RE_SSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_SSQUOTED_STRING, 0);
};

StringOrBareStringContext.prototype.CDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.CDQUOTED_STRING, 0);
};

StringOrBareStringContext.prototype.RE_CDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_CDQUOTED_STRING, 0);
};

StringOrBareStringContext.prototype.CSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.CSQUOTED_STRING, 0);
};

StringOrBareStringContext.prototype.RE_CSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_CSQUOTED_STRING, 0);
};

StringOrBareStringContext.prototype.RAW_ID = function() {
  return this.getToken(ScrollQLParser.RAW_ID, 0);
};

StringOrBareStringContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterStringOrBareString(this);
  }
};

StringOrBareStringContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitStringOrBareString(this);
  }
};

ScrollQLParser.StringOrBareStringContext = StringOrBareStringContext;

ScrollQLParser.prototype.stringOrBareString = function() {
  var localctx = new StringOrBareStringContext(this, this._ctx, this.state);
  this.enterRule(localctx, 76, ScrollQLParser.RULE_stringOrBareString);
  var _la = 0; // Token type
  try {
    this.state = 498;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.SDQUOTED_STRING:
      case ScrollQLParser.RE_SDQUOTED_STRING:
        this.enterOuterAlt(localctx, 1);
        this.state = 493;
        localctx.sdqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.SDQUOTED_STRING || _la === ScrollQLParser.RE_SDQUOTED_STRING)) {
          localctx.sdqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.SSQUOTED_STRING:
      case ScrollQLParser.RE_SSQUOTED_STRING:
        this.enterOuterAlt(localctx, 2);
        this.state = 494;
        localctx.ssqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.SSQUOTED_STRING || _la === ScrollQLParser.RE_SSQUOTED_STRING)) {
          localctx.ssqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.CDQUOTED_STRING:
      case ScrollQLParser.RE_CDQUOTED_STRING:
        this.enterOuterAlt(localctx, 3);
        this.state = 495;
        localctx.cdqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.CDQUOTED_STRING || _la === ScrollQLParser.RE_CDQUOTED_STRING)) {
          localctx.cdqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.CSQUOTED_STRING:
      case ScrollQLParser.RE_CSQUOTED_STRING:
        this.enterOuterAlt(localctx, 4);
        this.state = 496;
        localctx.csqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.CSQUOTED_STRING || _la === ScrollQLParser.RE_CSQUOTED_STRING)) {
          localctx.csqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.RAW_ID:
        this.enterOuterAlt(localctx, 5);
        this.state = 497;
        localctx.bstr = this.match(ScrollQLParser.RAW_ID);
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function RegexContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_regex;
  return this;
}

RegexContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
RegexContext.prototype.constructor = RegexContext;

RegexContext.prototype.REGEX = function() {
  return this.getToken(ScrollQLParser.REGEX, 0);
};

RegexContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterRegex(this);
  }
};

RegexContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitRegex(this);
  }
};

ScrollQLParser.RegexContext = RegexContext;

ScrollQLParser.prototype.regex = function() {
  var localctx = new RegexContext(this, this._ctx, this.state);
  this.enterRule(localctx, 78, ScrollQLParser.RULE_regex);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 500;
    this.match(ScrollQLParser.REGEX);
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function RegexStringContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_regexString;
  this.sdqstr = null; // Token
  this.ssqstr = null; // Token
  this.cdqstr = null; // Token
  this.csqstr = null; // Token
  return this;
}

RegexStringContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
RegexStringContext.prototype.constructor = RegexStringContext;

RegexStringContext.prototype.RE_SDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_SDQUOTED_STRING, 0);
};

RegexStringContext.prototype.RE_SSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_SSQUOTED_STRING, 0);
};

RegexStringContext.prototype.RE_CDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_CDQUOTED_STRING, 0);
};

RegexStringContext.prototype.RE_CSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_CSQUOTED_STRING, 0);
};

RegexStringContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterRegexString(this);
  }
};

RegexStringContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitRegexString(this);
  }
};

ScrollQLParser.RegexStringContext = RegexStringContext;

ScrollQLParser.prototype.regexString = function() {
  var localctx = new RegexStringContext(this, this._ctx, this.state);
  this.enterRule(localctx, 80, ScrollQLParser.RULE_regexString);
  try {
    this.state = 506;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.RE_SDQUOTED_STRING:
        this.enterOuterAlt(localctx, 1);
        this.state = 502;
        localctx.sdqstr = this.match(ScrollQLParser.RE_SDQUOTED_STRING);
        break;
      case ScrollQLParser.RE_SSQUOTED_STRING:
        this.enterOuterAlt(localctx, 2);
        this.state = 503;
        localctx.ssqstr = this.match(ScrollQLParser.RE_SSQUOTED_STRING);
        break;
      case ScrollQLParser.RE_CDQUOTED_STRING:
        this.enterOuterAlt(localctx, 3);
        this.state = 504;
        localctx.cdqstr = this.match(ScrollQLParser.RE_CDQUOTED_STRING);
        break;
      case ScrollQLParser.RE_CSQUOTED_STRING:
        this.enterOuterAlt(localctx, 4);
        this.state = 505;
        localctx.csqstr = this.match(ScrollQLParser.RE_CSQUOTED_STRING);
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function LogIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_logId;
  this.raw = null; // Token
  this.keyw = null; // KeywordsContext
  this.keywt = null; // TimeUnitKeywordsContext
  this.sdqstr = null; // Token
  this.ssqstr = null; // Token
  this.cdqstr = null; // Token
  this.csqstr = null; // Token
  return this;
}

LogIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
LogIdContext.prototype.constructor = LogIdContext;

LogIdContext.prototype.RAW_ID = function() {
  return this.getToken(ScrollQLParser.RAW_ID, 0);
};

LogIdContext.prototype.keywords = function() {
  return this.getTypedRuleContext(KeywordsContext, 0);
};

LogIdContext.prototype.timeUnitKeywords = function() {
  return this.getTypedRuleContext(TimeUnitKeywordsContext, 0);
};

LogIdContext.prototype.SDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SDQUOTED_STRING, 0);
};

LogIdContext.prototype.RE_SDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_SDQUOTED_STRING, 0);
};

LogIdContext.prototype.SSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.SSQUOTED_STRING, 0);
};

LogIdContext.prototype.RE_SSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_SSQUOTED_STRING, 0);
};

LogIdContext.prototype.CDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.CDQUOTED_STRING, 0);
};

LogIdContext.prototype.RE_CDQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_CDQUOTED_STRING, 0);
};

LogIdContext.prototype.CSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.CSQUOTED_STRING, 0);
};

LogIdContext.prototype.RE_CSQUOTED_STRING = function() {
  return this.getToken(ScrollQLParser.RE_CSQUOTED_STRING, 0);
};

LogIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterLogId(this);
  }
};

LogIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitLogId(this);
  }
};

ScrollQLParser.LogIdContext = LogIdContext;

ScrollQLParser.prototype.logId = function() {
  var localctx = new LogIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 82, ScrollQLParser.RULE_logId);
  var _la = 0; // Token type
  try {
    this.state = 515;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.RAW_ID:
        this.enterOuterAlt(localctx, 1);
        this.state = 508;
        localctx.raw = this.match(ScrollQLParser.RAW_ID);
        break;
      case ScrollQLParser.K_SOURCE:
      case ScrollQLParser.K_START:
      case ScrollQLParser.K_END:
      case ScrollQLParser.K_NOW:
      case ScrollQLParser.K_LIVE:
      case ScrollQLParser.K_PARSE:
      case ScrollQLParser.K_SEARCH:
      case ScrollQLParser.K_FIELDS:
      case ScrollQLParser.K_DISPLAY:
      case ScrollQLParser.K_FILTER:
      case ScrollQLParser.K_STATS:
      case ScrollQLParser.K_SORT:
      case ScrollQLParser.K_ORDER:
      case ScrollQLParser.K_ASC:
      case ScrollQLParser.K_DESC:
      case ScrollQLParser.K_HEAD:
      case ScrollQLParser.K_LIMIT:
      case ScrollQLParser.K_TAIL:
      case ScrollQLParser.K_REGEX:
      case ScrollQLParser.K_IN:
      case ScrollQLParser.K_GROUP:
      case ScrollQLParser.K_BY:
      case ScrollQLParser.K_AS:
      case ScrollQLParser.K_AND:
      case ScrollQLParser.K_OR:
      case ScrollQLParser.K_NOT:
      case ScrollQLParser.K_LIKE:
      case ScrollQLParser.K_MATCHES:
        this.enterOuterAlt(localctx, 2);
        this.state = 509;
        localctx.keyw = this.keywords();
        break;
      case ScrollQLParser.K_TU_MS:
      case ScrollQLParser.K_TU_MSEC:
      case ScrollQLParser.K_TU_MSECOND:
      case ScrollQLParser.K_TU_S:
      case ScrollQLParser.K_TU_SEC:
      case ScrollQLParser.K_TU_SECOND:
      case ScrollQLParser.K_TU_M:
      case ScrollQLParser.K_TU_MIN:
      case ScrollQLParser.K_TU_MINUTE:
      case ScrollQLParser.K_TU_H:
      case ScrollQLParser.K_TU_HR:
      case ScrollQLParser.K_TU_HOUR:
      case ScrollQLParser.K_TU_D:
      case ScrollQLParser.K_TU_DAY:
      case ScrollQLParser.K_TU_W:
      case ScrollQLParser.K_TU_WEEK:
      case ScrollQLParser.K_TU_MO:
      case ScrollQLParser.K_TU_MON:
      case ScrollQLParser.K_TU_MONTH:
      case ScrollQLParser.K_TU_Q:
      case ScrollQLParser.K_TU_QTR:
      case ScrollQLParser.K_TU_QUARTER:
      case ScrollQLParser.K_TU_Y:
      case ScrollQLParser.K_TU_YR:
      case ScrollQLParser.K_TU_YEAR:
        this.enterOuterAlt(localctx, 3);
        this.state = 510;
        localctx.keywt = this.timeUnitKeywords();
        break;
      case ScrollQLParser.SDQUOTED_STRING:
      case ScrollQLParser.RE_SDQUOTED_STRING:
        this.enterOuterAlt(localctx, 4);
        this.state = 511;
        localctx.sdqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.SDQUOTED_STRING || _la === ScrollQLParser.RE_SDQUOTED_STRING)) {
          localctx.sdqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.SSQUOTED_STRING:
      case ScrollQLParser.RE_SSQUOTED_STRING:
        this.enterOuterAlt(localctx, 5);
        this.state = 512;
        localctx.ssqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.SSQUOTED_STRING || _la === ScrollQLParser.RE_SSQUOTED_STRING)) {
          localctx.ssqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.CDQUOTED_STRING:
      case ScrollQLParser.RE_CDQUOTED_STRING:
        this.enterOuterAlt(localctx, 6);
        this.state = 513;
        localctx.cdqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.CDQUOTED_STRING || _la === ScrollQLParser.RE_CDQUOTED_STRING)) {
          localctx.cdqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.CSQUOTED_STRING:
      case ScrollQLParser.RE_CSQUOTED_STRING:
        this.enterOuterAlt(localctx, 7);
        this.state = 514;
        localctx.csqstr = this._input.LT(1);
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.CSQUOTED_STRING || _la === ScrollQLParser.RE_CSQUOTED_STRING)) {
          localctx.csqstr = this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function FieldIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_fieldId;
  this.uid = null; // UserIdContext
  this.sid = null; // SystemIdContext
  return this;
}

FieldIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
FieldIdContext.prototype.constructor = FieldIdContext;

FieldIdContext.prototype.userId = function() {
  return this.getTypedRuleContext(UserIdContext, 0);
};

FieldIdContext.prototype.systemId = function() {
  return this.getTypedRuleContext(SystemIdContext, 0);
};

FieldIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterFieldId(this);
  }
};

FieldIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitFieldId(this);
  }
};

ScrollQLParser.FieldIdContext = FieldIdContext;

ScrollQLParser.prototype.fieldId = function() {
  var localctx = new FieldIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 84, ScrollQLParser.RULE_fieldId);
  try {
    this.state = 519;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 62, this._ctx);
    switch (la_) {
      case 1:
        this.enterOuterAlt(localctx, 1);
        this.state = 517;
        localctx.uid = this.userId();
        break;

      case 2:
        this.enterOuterAlt(localctx, 2);
        this.state = 518;
        localctx.sid = this.systemId();
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function AliasIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_aliasId;
  this.uid = null; // UserIdContext
  this.sid = null; // SystemIdContext
  return this;
}

AliasIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
AliasIdContext.prototype.constructor = AliasIdContext;

AliasIdContext.prototype.userId = function() {
  return this.getTypedRuleContext(UserIdContext, 0);
};

AliasIdContext.prototype.systemId = function() {
  return this.getTypedRuleContext(SystemIdContext, 0);
};

AliasIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterAliasId(this);
  }
};

AliasIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitAliasId(this);
  }
};

ScrollQLParser.AliasIdContext = AliasIdContext;

ScrollQLParser.prototype.aliasId = function() {
  var localctx = new AliasIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 86, ScrollQLParser.RULE_aliasId);
  try {
    this.state = 523;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 63, this._ctx);
    switch (la_) {
      case 1:
        this.enterOuterAlt(localctx, 1);
        this.state = 521;
        localctx.uid = this.userId();
        break;

      case 2:
        this.enterOuterAlt(localctx, 2);
        this.state = 522;
        localctx.sid = this.systemId();
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function UserIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_userId;
  this.usid = null; // UnquotedUserIdContext
  this.qsid = null; // QuotedUserIdContext
  return this;
}

UserIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
UserIdContext.prototype.constructor = UserIdContext;

UserIdContext.prototype.unquotedUserId = function() {
  return this.getTypedRuleContext(UnquotedUserIdContext, 0);
};

UserIdContext.prototype.quotedUserId = function() {
  return this.getTypedRuleContext(QuotedUserIdContext, 0);
};

UserIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterUserId(this);
  }
};

UserIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitUserId(this);
  }
};

ScrollQLParser.UserIdContext = UserIdContext;

ScrollQLParser.prototype.userId = function() {
  var localctx = new UserIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 88, ScrollQLParser.RULE_userId);
  try {
    this.state = 527;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.K_SOURCE:
      case ScrollQLParser.K_START:
      case ScrollQLParser.K_END:
      case ScrollQLParser.K_NOW:
      case ScrollQLParser.K_LIVE:
      case ScrollQLParser.K_PARSE:
      case ScrollQLParser.K_SEARCH:
      case ScrollQLParser.K_FIELDS:
      case ScrollQLParser.K_DISPLAY:
      case ScrollQLParser.K_FILTER:
      case ScrollQLParser.K_STATS:
      case ScrollQLParser.K_SORT:
      case ScrollQLParser.K_ORDER:
      case ScrollQLParser.K_ASC:
      case ScrollQLParser.K_DESC:
      case ScrollQLParser.K_HEAD:
      case ScrollQLParser.K_LIMIT:
      case ScrollQLParser.K_TAIL:
      case ScrollQLParser.K_REGEX:
      case ScrollQLParser.K_IN:
      case ScrollQLParser.K_GROUP:
      case ScrollQLParser.K_BY:
      case ScrollQLParser.K_AS:
      case ScrollQLParser.K_AND:
      case ScrollQLParser.K_OR:
      case ScrollQLParser.K_NOT:
      case ScrollQLParser.K_LIKE:
      case ScrollQLParser.K_MATCHES:
      case ScrollQLParser.K_TU_MS:
      case ScrollQLParser.K_TU_MSEC:
      case ScrollQLParser.K_TU_MSECOND:
      case ScrollQLParser.K_TU_S:
      case ScrollQLParser.K_TU_SEC:
      case ScrollQLParser.K_TU_SECOND:
      case ScrollQLParser.K_TU_M:
      case ScrollQLParser.K_TU_MIN:
      case ScrollQLParser.K_TU_MINUTE:
      case ScrollQLParser.K_TU_H:
      case ScrollQLParser.K_TU_HR:
      case ScrollQLParser.K_TU_HOUR:
      case ScrollQLParser.K_TU_D:
      case ScrollQLParser.K_TU_DAY:
      case ScrollQLParser.K_TU_W:
      case ScrollQLParser.K_TU_WEEK:
      case ScrollQLParser.K_TU_MO:
      case ScrollQLParser.K_TU_MON:
      case ScrollQLParser.K_TU_MONTH:
      case ScrollQLParser.K_TU_Q:
      case ScrollQLParser.K_TU_QTR:
      case ScrollQLParser.K_TU_QUARTER:
      case ScrollQLParser.K_TU_Y:
      case ScrollQLParser.K_TU_YR:
      case ScrollQLParser.K_TU_YEAR:
      case ScrollQLParser.RAW_ID:
      case ScrollQLParser.SYM_AT:
      case ScrollQLParser.RE_RAW_ID:
      case ScrollQLParser.RE_SYM_AT:
        this.enterOuterAlt(localctx, 1);
        this.state = 525;
        localctx.usid = this.unquotedUserId();
        break;
      case ScrollQLParser.QUOTED_IDENT:
      case ScrollQLParser.RE_QUOTED_IDENT:
        this.enterOuterAlt(localctx, 2);
        this.state = 526;
        localctx.qsid = this.quotedUserId();
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function UnquotedUserIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_unquotedUserId;
  this.uubid = null; // UnquotedUserBareIdContext
  this.uuaid = null; // UnquotedUserAtIdContext
  return this;
}

UnquotedUserIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
UnquotedUserIdContext.prototype.constructor = UnquotedUserIdContext;

UnquotedUserIdContext.prototype.unquotedUserBareId = function() {
  return this.getTypedRuleContext(UnquotedUserBareIdContext, 0);
};

UnquotedUserIdContext.prototype.unquotedUserAtId = function() {
  return this.getTypedRuleContext(UnquotedUserAtIdContext, 0);
};

UnquotedUserIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterUnquotedUserId(this);
  }
};

UnquotedUserIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitUnquotedUserId(this);
  }
};

ScrollQLParser.UnquotedUserIdContext = UnquotedUserIdContext;

ScrollQLParser.prototype.unquotedUserId = function() {
  var localctx = new UnquotedUserIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 90, ScrollQLParser.RULE_unquotedUserId);
  try {
    this.state = 531;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.K_SOURCE:
      case ScrollQLParser.K_START:
      case ScrollQLParser.K_END:
      case ScrollQLParser.K_NOW:
      case ScrollQLParser.K_LIVE:
      case ScrollQLParser.K_PARSE:
      case ScrollQLParser.K_SEARCH:
      case ScrollQLParser.K_FIELDS:
      case ScrollQLParser.K_DISPLAY:
      case ScrollQLParser.K_FILTER:
      case ScrollQLParser.K_STATS:
      case ScrollQLParser.K_SORT:
      case ScrollQLParser.K_ORDER:
      case ScrollQLParser.K_ASC:
      case ScrollQLParser.K_DESC:
      case ScrollQLParser.K_HEAD:
      case ScrollQLParser.K_LIMIT:
      case ScrollQLParser.K_TAIL:
      case ScrollQLParser.K_REGEX:
      case ScrollQLParser.K_IN:
      case ScrollQLParser.K_GROUP:
      case ScrollQLParser.K_BY:
      case ScrollQLParser.K_AS:
      case ScrollQLParser.K_AND:
      case ScrollQLParser.K_OR:
      case ScrollQLParser.K_NOT:
      case ScrollQLParser.K_LIKE:
      case ScrollQLParser.K_MATCHES:
      case ScrollQLParser.K_TU_MS:
      case ScrollQLParser.K_TU_MSEC:
      case ScrollQLParser.K_TU_MSECOND:
      case ScrollQLParser.K_TU_S:
      case ScrollQLParser.K_TU_SEC:
      case ScrollQLParser.K_TU_SECOND:
      case ScrollQLParser.K_TU_M:
      case ScrollQLParser.K_TU_MIN:
      case ScrollQLParser.K_TU_MINUTE:
      case ScrollQLParser.K_TU_H:
      case ScrollQLParser.K_TU_HR:
      case ScrollQLParser.K_TU_HOUR:
      case ScrollQLParser.K_TU_D:
      case ScrollQLParser.K_TU_DAY:
      case ScrollQLParser.K_TU_W:
      case ScrollQLParser.K_TU_WEEK:
      case ScrollQLParser.K_TU_MO:
      case ScrollQLParser.K_TU_MON:
      case ScrollQLParser.K_TU_MONTH:
      case ScrollQLParser.K_TU_Q:
      case ScrollQLParser.K_TU_QTR:
      case ScrollQLParser.K_TU_QUARTER:
      case ScrollQLParser.K_TU_Y:
      case ScrollQLParser.K_TU_YR:
      case ScrollQLParser.K_TU_YEAR:
      case ScrollQLParser.RAW_ID:
      case ScrollQLParser.RE_RAW_ID:
        this.enterOuterAlt(localctx, 1);
        this.state = 529;
        localctx.uubid = this.unquotedUserBareId();
        break;
      case ScrollQLParser.SYM_AT:
      case ScrollQLParser.RE_SYM_AT:
        this.enterOuterAlt(localctx, 2);
        this.state = 530;
        localctx.uuaid = this.unquotedUserAtId();
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function UnquotedUserAtIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_unquotedUserAtId;
  return this;
}

UnquotedUserAtIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
UnquotedUserAtIdContext.prototype.constructor = UnquotedUserAtIdContext;

UnquotedUserAtIdContext.prototype.rawId = function() {
  return this.getTypedRuleContext(RawIdContext, 0);
};

UnquotedUserAtIdContext.prototype.SYM_AT = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.SYM_AT);
  } else {
    return this.getToken(ScrollQLParser.SYM_AT, i);
  }
};

UnquotedUserAtIdContext.prototype.RE_SYM_AT = function(i) {
  if (i === undefined) {
    i = null;
  }
  if (i === null) {
    return this.getTokens(ScrollQLParser.RE_SYM_AT);
  } else {
    return this.getToken(ScrollQLParser.RE_SYM_AT, i);
  }
};

UnquotedUserAtIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterUnquotedUserAtId(this);
  }
};

UnquotedUserAtIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitUnquotedUserAtId(this);
  }
};

ScrollQLParser.UnquotedUserAtIdContext = UnquotedUserAtIdContext;

ScrollQLParser.prototype.unquotedUserAtId = function() {
  var localctx = new UnquotedUserAtIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 92, ScrollQLParser.RULE_unquotedUserAtId);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 533;
    _la = this._input.LA(1);
    if (!(_la === ScrollQLParser.SYM_AT || _la === ScrollQLParser.RE_SYM_AT)) {
      this._errHandler.recoverInline(this);
    } else {
      this._errHandler.reportMatch(this);
      this.consume();
    }
    this.state = 535;
    this._errHandler.sync(this);
    _la = this._input.LA(1);
    do {
      this.state = 534;
      _la = this._input.LA(1);
      if (!(_la === ScrollQLParser.SYM_AT || _la === ScrollQLParser.RE_SYM_AT)) {
        this._errHandler.recoverInline(this);
      } else {
        this._errHandler.reportMatch(this);
        this.consume();
      }
      this.state = 537;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
    } while (_la === ScrollQLParser.SYM_AT || _la === ScrollQLParser.RE_SYM_AT);
    this.state = 539;
    this.rawId();
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function UnquotedUserBareIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_unquotedUserBareId;
  this.uid = null; // RawIdContext
  return this;
}

UnquotedUserBareIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
UnquotedUserBareIdContext.prototype.constructor = UnquotedUserBareIdContext;

UnquotedUserBareIdContext.prototype.rawId = function() {
  return this.getTypedRuleContext(RawIdContext, 0);
};

UnquotedUserBareIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterUnquotedUserBareId(this);
  }
};

UnquotedUserBareIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitUnquotedUserBareId(this);
  }
};

ScrollQLParser.UnquotedUserBareIdContext = UnquotedUserBareIdContext;

ScrollQLParser.prototype.unquotedUserBareId = function() {
  var localctx = new UnquotedUserBareIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 94, ScrollQLParser.RULE_unquotedUserBareId);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 541;
    localctx.uid = this.rawId();
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function QuotedUserIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_quotedUserId;
  this.qid = null; // Token
  return this;
}

QuotedUserIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
QuotedUserIdContext.prototype.constructor = QuotedUserIdContext;

QuotedUserIdContext.prototype.QUOTED_IDENT = function() {
  return this.getToken(ScrollQLParser.QUOTED_IDENT, 0);
};

QuotedUserIdContext.prototype.RE_QUOTED_IDENT = function() {
  return this.getToken(ScrollQLParser.RE_QUOTED_IDENT, 0);
};

QuotedUserIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterQuotedUserId(this);
  }
};

QuotedUserIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitQuotedUserId(this);
  }
};

ScrollQLParser.QuotedUserIdContext = QuotedUserIdContext;

ScrollQLParser.prototype.quotedUserId = function() {
  var localctx = new QuotedUserIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 96, ScrollQLParser.RULE_quotedUserId);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 543;
    localctx.qid = this._input.LT(1);
    _la = this._input.LA(1);
    if (!(_la === ScrollQLParser.QUOTED_IDENT || _la === ScrollQLParser.RE_QUOTED_IDENT)) {
      localctx.qid = this._errHandler.recoverInline(this);
    } else {
      this._errHandler.reportMatch(this);
      this.consume();
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function SystemIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_systemId;
  this.usid = null; // UnquotedSystemIdContext
  this.qsid = null; // QuotedSystemIdContext
  return this;
}

SystemIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
SystemIdContext.prototype.constructor = SystemIdContext;

SystemIdContext.prototype.unquotedSystemId = function() {
  return this.getTypedRuleContext(UnquotedSystemIdContext, 0);
};

SystemIdContext.prototype.quotedSystemId = function() {
  return this.getTypedRuleContext(QuotedSystemIdContext, 0);
};

SystemIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterSystemId(this);
  }
};

SystemIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitSystemId(this);
  }
};

ScrollQLParser.SystemIdContext = SystemIdContext;

ScrollQLParser.prototype.systemId = function() {
  var localctx = new SystemIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 98, ScrollQLParser.RULE_systemId);
  try {
    this.state = 547;
    this._errHandler.sync(this);
    var la_ = this._interp.adaptivePredict(this._input, 67, this._ctx);
    switch (la_) {
      case 1:
        this.enterOuterAlt(localctx, 1);
        this.state = 545;
        localctx.usid = this.unquotedSystemId();
        break;

      case 2:
        this.enterOuterAlt(localctx, 2);
        this.state = 546;
        localctx.qsid = this.quotedSystemId();
        break;
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function UnquotedSystemIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_unquotedSystemId;
  this.udid = null; // RawIdContext
  return this;
}

UnquotedSystemIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
UnquotedSystemIdContext.prototype.constructor = UnquotedSystemIdContext;

UnquotedSystemIdContext.prototype.SYM_AT = function() {
  return this.getToken(ScrollQLParser.SYM_AT, 0);
};

UnquotedSystemIdContext.prototype.RE_SYM_AT = function() {
  return this.getToken(ScrollQLParser.RE_SYM_AT, 0);
};

UnquotedSystemIdContext.prototype.rawId = function() {
  return this.getTypedRuleContext(RawIdContext, 0);
};

UnquotedSystemIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterUnquotedSystemId(this);
  }
};

UnquotedSystemIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitUnquotedSystemId(this);
  }
};

ScrollQLParser.UnquotedSystemIdContext = UnquotedSystemIdContext;

ScrollQLParser.prototype.unquotedSystemId = function() {
  var localctx = new UnquotedSystemIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 100, ScrollQLParser.RULE_unquotedSystemId);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 549;
    _la = this._input.LA(1);
    if (!(_la === ScrollQLParser.SYM_AT || _la === ScrollQLParser.RE_SYM_AT)) {
      this._errHandler.recoverInline(this);
    } else {
      this._errHandler.reportMatch(this);
      this.consume();
    }
    this.state = 550;
    localctx.udid = this.rawId();
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function QuotedSystemIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_quotedSystemId;
  this.qid = null; // Token
  return this;
}

QuotedSystemIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
QuotedSystemIdContext.prototype.constructor = QuotedSystemIdContext;

QuotedSystemIdContext.prototype.SYM_AT = function() {
  return this.getToken(ScrollQLParser.SYM_AT, 0);
};

QuotedSystemIdContext.prototype.RE_SYM_AT = function() {
  return this.getToken(ScrollQLParser.RE_SYM_AT, 0);
};

QuotedSystemIdContext.prototype.QUOTED_IDENT = function() {
  return this.getToken(ScrollQLParser.QUOTED_IDENT, 0);
};

QuotedSystemIdContext.prototype.RE_QUOTED_IDENT = function() {
  return this.getToken(ScrollQLParser.RE_QUOTED_IDENT, 0);
};

QuotedSystemIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterQuotedSystemId(this);
  }
};

QuotedSystemIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitQuotedSystemId(this);
  }
};

ScrollQLParser.QuotedSystemIdContext = QuotedSystemIdContext;

ScrollQLParser.prototype.quotedSystemId = function() {
  var localctx = new QuotedSystemIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 102, ScrollQLParser.RULE_quotedSystemId);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 552;
    _la = this._input.LA(1);
    if (!(_la === ScrollQLParser.SYM_AT || _la === ScrollQLParser.RE_SYM_AT)) {
      this._errHandler.recoverInline(this);
    } else {
      this._errHandler.reportMatch(this);
      this.consume();
    }
    this.state = 553;
    localctx.qid = this._input.LT(1);
    _la = this._input.LA(1);
    if (!(_la === ScrollQLParser.QUOTED_IDENT || _la === ScrollQLParser.RE_QUOTED_IDENT)) {
      localctx.qid = this._errHandler.recoverInline(this);
    } else {
      this._errHandler.reportMatch(this);
      this.consume();
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function ResultIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_resultId;
  return this;
}

ResultIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
ResultIdContext.prototype.constructor = ResultIdContext;

ResultIdContext.prototype.rawId = function() {
  return this.getTypedRuleContext(RawIdContext, 0);
};

ResultIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterResultId(this);
  }
};

ResultIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitResultId(this);
  }
};

ScrollQLParser.ResultIdContext = ResultIdContext;

ScrollQLParser.prototype.resultId = function() {
  var localctx = new ResultIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 104, ScrollQLParser.RULE_resultId);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 555;
    this.rawId();
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function FunctionIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_functionId;
  return this;
}

FunctionIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
FunctionIdContext.prototype.constructor = FunctionIdContext;

FunctionIdContext.prototype.rawId = function() {
  return this.getTypedRuleContext(RawIdContext, 0);
};

FunctionIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterFunctionId(this);
  }
};

FunctionIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitFunctionId(this);
  }
};

ScrollQLParser.FunctionIdContext = FunctionIdContext;

ScrollQLParser.prototype.functionId = function() {
  var localctx = new FunctionIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 106, ScrollQLParser.RULE_functionId);
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 557;
    this.rawId();
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function RawIdContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_rawId;
  return this;
}

RawIdContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
RawIdContext.prototype.constructor = RawIdContext;

RawIdContext.prototype.RAW_ID = function() {
  return this.getToken(ScrollQLParser.RAW_ID, 0);
};

RawIdContext.prototype.RE_RAW_ID = function() {
  return this.getToken(ScrollQLParser.RE_RAW_ID, 0);
};

RawIdContext.prototype.keywords = function() {
  return this.getTypedRuleContext(KeywordsContext, 0);
};

RawIdContext.prototype.timeUnitKeywords = function() {
  return this.getTypedRuleContext(TimeUnitKeywordsContext, 0);
};

RawIdContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterRawId(this);
  }
};

RawIdContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitRawId(this);
  }
};

ScrollQLParser.RawIdContext = RawIdContext;

ScrollQLParser.prototype.rawId = function() {
  var localctx = new RawIdContext(this, this._ctx, this.state);
  this.enterRule(localctx, 108, ScrollQLParser.RULE_rawId);
  var _la = 0; // Token type
  try {
    this.state = 562;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.RAW_ID:
      case ScrollQLParser.RE_RAW_ID:
        this.enterOuterAlt(localctx, 1);
        this.state = 559;
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.RAW_ID || _la === ScrollQLParser.RE_RAW_ID)) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.K_SOURCE:
      case ScrollQLParser.K_START:
      case ScrollQLParser.K_END:
      case ScrollQLParser.K_NOW:
      case ScrollQLParser.K_LIVE:
      case ScrollQLParser.K_PARSE:
      case ScrollQLParser.K_SEARCH:
      case ScrollQLParser.K_FIELDS:
      case ScrollQLParser.K_DISPLAY:
      case ScrollQLParser.K_FILTER:
      case ScrollQLParser.K_STATS:
      case ScrollQLParser.K_SORT:
      case ScrollQLParser.K_ORDER:
      case ScrollQLParser.K_ASC:
      case ScrollQLParser.K_DESC:
      case ScrollQLParser.K_HEAD:
      case ScrollQLParser.K_LIMIT:
      case ScrollQLParser.K_TAIL:
      case ScrollQLParser.K_REGEX:
      case ScrollQLParser.K_IN:
      case ScrollQLParser.K_GROUP:
      case ScrollQLParser.K_BY:
      case ScrollQLParser.K_AS:
      case ScrollQLParser.K_AND:
      case ScrollQLParser.K_OR:
      case ScrollQLParser.K_NOT:
      case ScrollQLParser.K_LIKE:
      case ScrollQLParser.K_MATCHES:
        this.enterOuterAlt(localctx, 2);
        this.state = 560;
        this.keywords();
        break;
      case ScrollQLParser.K_TU_MS:
      case ScrollQLParser.K_TU_MSEC:
      case ScrollQLParser.K_TU_MSECOND:
      case ScrollQLParser.K_TU_S:
      case ScrollQLParser.K_TU_SEC:
      case ScrollQLParser.K_TU_SECOND:
      case ScrollQLParser.K_TU_M:
      case ScrollQLParser.K_TU_MIN:
      case ScrollQLParser.K_TU_MINUTE:
      case ScrollQLParser.K_TU_H:
      case ScrollQLParser.K_TU_HR:
      case ScrollQLParser.K_TU_HOUR:
      case ScrollQLParser.K_TU_D:
      case ScrollQLParser.K_TU_DAY:
      case ScrollQLParser.K_TU_W:
      case ScrollQLParser.K_TU_WEEK:
      case ScrollQLParser.K_TU_MO:
      case ScrollQLParser.K_TU_MON:
      case ScrollQLParser.K_TU_MONTH:
      case ScrollQLParser.K_TU_Q:
      case ScrollQLParser.K_TU_QTR:
      case ScrollQLParser.K_TU_QUARTER:
      case ScrollQLParser.K_TU_Y:
      case ScrollQLParser.K_TU_YR:
      case ScrollQLParser.K_TU_YEAR:
        this.enterOuterAlt(localctx, 3);
        this.state = 561;
        this.timeUnitKeywords();
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function KeywordsContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_keywords;
  return this;
}

KeywordsContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
KeywordsContext.prototype.constructor = KeywordsContext;

KeywordsContext.prototype.K_SOURCE = function() {
  return this.getToken(ScrollQLParser.K_SOURCE, 0);
};

KeywordsContext.prototype.K_START = function() {
  return this.getToken(ScrollQLParser.K_START, 0);
};

KeywordsContext.prototype.K_END = function() {
  return this.getToken(ScrollQLParser.K_END, 0);
};

KeywordsContext.prototype.K_NOW = function() {
  return this.getToken(ScrollQLParser.K_NOW, 0);
};

KeywordsContext.prototype.K_LIVE = function() {
  return this.getToken(ScrollQLParser.K_LIVE, 0);
};

KeywordsContext.prototype.K_PARSE = function() {
  return this.getToken(ScrollQLParser.K_PARSE, 0);
};

KeywordsContext.prototype.K_SEARCH = function() {
  return this.getToken(ScrollQLParser.K_SEARCH, 0);
};

KeywordsContext.prototype.K_FIELDS = function() {
  return this.getToken(ScrollQLParser.K_FIELDS, 0);
};

KeywordsContext.prototype.K_DISPLAY = function() {
  return this.getToken(ScrollQLParser.K_DISPLAY, 0);
};

KeywordsContext.prototype.K_FILTER = function() {
  return this.getToken(ScrollQLParser.K_FILTER, 0);
};

KeywordsContext.prototype.K_STATS = function() {
  return this.getToken(ScrollQLParser.K_STATS, 0);
};

KeywordsContext.prototype.K_GROUP = function() {
  return this.getToken(ScrollQLParser.K_GROUP, 0);
};

KeywordsContext.prototype.K_BY = function() {
  return this.getToken(ScrollQLParser.K_BY, 0);
};

KeywordsContext.prototype.K_AS = function() {
  return this.getToken(ScrollQLParser.K_AS, 0);
};

KeywordsContext.prototype.K_SORT = function() {
  return this.getToken(ScrollQLParser.K_SORT, 0);
};

KeywordsContext.prototype.K_ORDER = function() {
  return this.getToken(ScrollQLParser.K_ORDER, 0);
};

KeywordsContext.prototype.K_ASC = function() {
  return this.getToken(ScrollQLParser.K_ASC, 0);
};

KeywordsContext.prototype.K_DESC = function() {
  return this.getToken(ScrollQLParser.K_DESC, 0);
};

KeywordsContext.prototype.K_HEAD = function() {
  return this.getToken(ScrollQLParser.K_HEAD, 0);
};

KeywordsContext.prototype.K_TAIL = function() {
  return this.getToken(ScrollQLParser.K_TAIL, 0);
};

KeywordsContext.prototype.K_LIMIT = function() {
  return this.getToken(ScrollQLParser.K_LIMIT, 0);
};

KeywordsContext.prototype.K_AND = function() {
  return this.getToken(ScrollQLParser.K_AND, 0);
};

KeywordsContext.prototype.K_OR = function() {
  return this.getToken(ScrollQLParser.K_OR, 0);
};

KeywordsContext.prototype.K_NOT = function() {
  return this.getToken(ScrollQLParser.K_NOT, 0);
};

KeywordsContext.prototype.K_LIKE = function() {
  return this.getToken(ScrollQLParser.K_LIKE, 0);
};

KeywordsContext.prototype.K_MATCHES = function() {
  return this.getToken(ScrollQLParser.K_MATCHES, 0);
};

KeywordsContext.prototype.K_REGEX = function() {
  return this.getToken(ScrollQLParser.K_REGEX, 0);
};

KeywordsContext.prototype.K_IN = function() {
  return this.getToken(ScrollQLParser.K_IN, 0);
};

KeywordsContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterKeywords(this);
  }
};

KeywordsContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitKeywords(this);
  }
};

ScrollQLParser.KeywordsContext = KeywordsContext;

ScrollQLParser.prototype.keywords = function() {
  var localctx = new KeywordsContext(this, this._ctx, this.state);
  this.enterRule(localctx, 110, ScrollQLParser.RULE_keywords);
  var _la = 0; // Token type
  try {
    this.enterOuterAlt(localctx, 1);
    this.state = 564;
    _la = this._input.LA(1);
    if (
      !(
        (_la & ~0x1f) == 0 &&
        ((1 << _la) &
          ((1 << ScrollQLParser.K_SOURCE) |
            (1 << ScrollQLParser.K_START) |
            (1 << ScrollQLParser.K_END) |
            (1 << ScrollQLParser.K_NOW) |
            (1 << ScrollQLParser.K_LIVE) |
            (1 << ScrollQLParser.K_PARSE) |
            (1 << ScrollQLParser.K_SEARCH) |
            (1 << ScrollQLParser.K_FIELDS) |
            (1 << ScrollQLParser.K_DISPLAY) |
            (1 << ScrollQLParser.K_FILTER) |
            (1 << ScrollQLParser.K_STATS) |
            (1 << ScrollQLParser.K_SORT) |
            (1 << ScrollQLParser.K_ORDER) |
            (1 << ScrollQLParser.K_ASC) |
            (1 << ScrollQLParser.K_DESC) |
            (1 << ScrollQLParser.K_HEAD) |
            (1 << ScrollQLParser.K_LIMIT) |
            (1 << ScrollQLParser.K_TAIL) |
            (1 << ScrollQLParser.K_REGEX) |
            (1 << ScrollQLParser.K_IN) |
            (1 << ScrollQLParser.K_GROUP) |
            (1 << ScrollQLParser.K_BY) |
            (1 << ScrollQLParser.K_AS) |
            (1 << ScrollQLParser.K_AND) |
            (1 << ScrollQLParser.K_OR) |
            (1 << ScrollQLParser.K_NOT) |
            (1 << ScrollQLParser.K_LIKE) |
            (1 << ScrollQLParser.K_MATCHES))) !==
          0
      )
    ) {
      this._errHandler.recoverInline(this);
    } else {
      this._errHandler.reportMatch(this);
      this.consume();
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

function TimeUnitKeywordsContext(parser, parent, invokingState) {
  if (parent === undefined) {
    parent = null;
  }
  if (invokingState === undefined || invokingState === null) {
    invokingState = -1;
  }
  antlr4.ParserRuleContext.call(this, parent, invokingState);
  this.parser = parser;
  this.ruleIndex = ScrollQLParser.RULE_timeUnitKeywords;
  return this;
}

TimeUnitKeywordsContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
TimeUnitKeywordsContext.prototype.constructor = TimeUnitKeywordsContext;

TimeUnitKeywordsContext.prototype.copyFrom = function(ctx) {
  antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function TimeUnitYearsContext(parser, ctx) {
  TimeUnitKeywordsContext.call(this, parser);
  TimeUnitKeywordsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TimeUnitYearsContext.prototype = Object.create(TimeUnitKeywordsContext.prototype);
TimeUnitYearsContext.prototype.constructor = TimeUnitYearsContext;

ScrollQLParser.TimeUnitYearsContext = TimeUnitYearsContext;

TimeUnitYearsContext.prototype.K_TU_Y = function() {
  return this.getToken(ScrollQLParser.K_TU_Y, 0);
};

TimeUnitYearsContext.prototype.K_TU_YR = function() {
  return this.getToken(ScrollQLParser.K_TU_YR, 0);
};

TimeUnitYearsContext.prototype.K_TU_YEAR = function() {
  return this.getToken(ScrollQLParser.K_TU_YEAR, 0);
};
TimeUnitYearsContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeUnitYears(this);
  }
};

TimeUnitYearsContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeUnitYears(this);
  }
};

function TimeUnitMinutesContext(parser, ctx) {
  TimeUnitKeywordsContext.call(this, parser);
  TimeUnitKeywordsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TimeUnitMinutesContext.prototype = Object.create(TimeUnitKeywordsContext.prototype);
TimeUnitMinutesContext.prototype.constructor = TimeUnitMinutesContext;

ScrollQLParser.TimeUnitMinutesContext = TimeUnitMinutesContext;

TimeUnitMinutesContext.prototype.K_TU_M = function() {
  return this.getToken(ScrollQLParser.K_TU_M, 0);
};

TimeUnitMinutesContext.prototype.K_TU_MIN = function() {
  return this.getToken(ScrollQLParser.K_TU_MIN, 0);
};

TimeUnitMinutesContext.prototype.K_TU_MINUTE = function() {
  return this.getToken(ScrollQLParser.K_TU_MINUTE, 0);
};
TimeUnitMinutesContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeUnitMinutes(this);
  }
};

TimeUnitMinutesContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeUnitMinutes(this);
  }
};

function TimeUnitHoursContext(parser, ctx) {
  TimeUnitKeywordsContext.call(this, parser);
  TimeUnitKeywordsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TimeUnitHoursContext.prototype = Object.create(TimeUnitKeywordsContext.prototype);
TimeUnitHoursContext.prototype.constructor = TimeUnitHoursContext;

ScrollQLParser.TimeUnitHoursContext = TimeUnitHoursContext;

TimeUnitHoursContext.prototype.K_TU_H = function() {
  return this.getToken(ScrollQLParser.K_TU_H, 0);
};

TimeUnitHoursContext.prototype.K_TU_HR = function() {
  return this.getToken(ScrollQLParser.K_TU_HR, 0);
};

TimeUnitHoursContext.prototype.K_TU_HOUR = function() {
  return this.getToken(ScrollQLParser.K_TU_HOUR, 0);
};
TimeUnitHoursContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeUnitHours(this);
  }
};

TimeUnitHoursContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeUnitHours(this);
  }
};

function TimeUnitWeeksContext(parser, ctx) {
  TimeUnitKeywordsContext.call(this, parser);
  TimeUnitKeywordsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TimeUnitWeeksContext.prototype = Object.create(TimeUnitKeywordsContext.prototype);
TimeUnitWeeksContext.prototype.constructor = TimeUnitWeeksContext;

ScrollQLParser.TimeUnitWeeksContext = TimeUnitWeeksContext;

TimeUnitWeeksContext.prototype.K_TU_W = function() {
  return this.getToken(ScrollQLParser.K_TU_W, 0);
};

TimeUnitWeeksContext.prototype.K_TU_WEEK = function() {
  return this.getToken(ScrollQLParser.K_TU_WEEK, 0);
};
TimeUnitWeeksContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeUnitWeeks(this);
  }
};

TimeUnitWeeksContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeUnitWeeks(this);
  }
};

function TimeUnitDaysContext(parser, ctx) {
  TimeUnitKeywordsContext.call(this, parser);
  TimeUnitKeywordsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TimeUnitDaysContext.prototype = Object.create(TimeUnitKeywordsContext.prototype);
TimeUnitDaysContext.prototype.constructor = TimeUnitDaysContext;

ScrollQLParser.TimeUnitDaysContext = TimeUnitDaysContext;

TimeUnitDaysContext.prototype.K_TU_D = function() {
  return this.getToken(ScrollQLParser.K_TU_D, 0);
};

TimeUnitDaysContext.prototype.K_TU_DAY = function() {
  return this.getToken(ScrollQLParser.K_TU_DAY, 0);
};
TimeUnitDaysContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeUnitDays(this);
  }
};

TimeUnitDaysContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeUnitDays(this);
  }
};

function TimeUnitMonthsContext(parser, ctx) {
  TimeUnitKeywordsContext.call(this, parser);
  TimeUnitKeywordsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TimeUnitMonthsContext.prototype = Object.create(TimeUnitKeywordsContext.prototype);
TimeUnitMonthsContext.prototype.constructor = TimeUnitMonthsContext;

ScrollQLParser.TimeUnitMonthsContext = TimeUnitMonthsContext;

TimeUnitMonthsContext.prototype.K_TU_MO = function() {
  return this.getToken(ScrollQLParser.K_TU_MO, 0);
};

TimeUnitMonthsContext.prototype.K_TU_MON = function() {
  return this.getToken(ScrollQLParser.K_TU_MON, 0);
};

TimeUnitMonthsContext.prototype.K_TU_MONTH = function() {
  return this.getToken(ScrollQLParser.K_TU_MONTH, 0);
};
TimeUnitMonthsContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeUnitMonths(this);
  }
};

TimeUnitMonthsContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeUnitMonths(this);
  }
};

function TimeUnitQuartersContext(parser, ctx) {
  TimeUnitKeywordsContext.call(this, parser);
  TimeUnitKeywordsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TimeUnitQuartersContext.prototype = Object.create(TimeUnitKeywordsContext.prototype);
TimeUnitQuartersContext.prototype.constructor = TimeUnitQuartersContext;

ScrollQLParser.TimeUnitQuartersContext = TimeUnitQuartersContext;

TimeUnitQuartersContext.prototype.K_TU_Q = function() {
  return this.getToken(ScrollQLParser.K_TU_Q, 0);
};

TimeUnitQuartersContext.prototype.K_TU_QTR = function() {
  return this.getToken(ScrollQLParser.K_TU_QTR, 0);
};

TimeUnitQuartersContext.prototype.K_TU_QUARTER = function() {
  return this.getToken(ScrollQLParser.K_TU_QUARTER, 0);
};
TimeUnitQuartersContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeUnitQuarters(this);
  }
};

TimeUnitQuartersContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeUnitQuarters(this);
  }
};

function TimeUnitMilliSecondsContext(parser, ctx) {
  TimeUnitKeywordsContext.call(this, parser);
  TimeUnitKeywordsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TimeUnitMilliSecondsContext.prototype = Object.create(TimeUnitKeywordsContext.prototype);
TimeUnitMilliSecondsContext.prototype.constructor = TimeUnitMilliSecondsContext;

ScrollQLParser.TimeUnitMilliSecondsContext = TimeUnitMilliSecondsContext;

TimeUnitMilliSecondsContext.prototype.K_TU_MS = function() {
  return this.getToken(ScrollQLParser.K_TU_MS, 0);
};

TimeUnitMilliSecondsContext.prototype.K_TU_MSEC = function() {
  return this.getToken(ScrollQLParser.K_TU_MSEC, 0);
};

TimeUnitMilliSecondsContext.prototype.K_TU_MSECOND = function() {
  return this.getToken(ScrollQLParser.K_TU_MSECOND, 0);
};
TimeUnitMilliSecondsContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeUnitMilliSeconds(this);
  }
};

TimeUnitMilliSecondsContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeUnitMilliSeconds(this);
  }
};

function TimeUnitSecondsContext(parser, ctx) {
  TimeUnitKeywordsContext.call(this, parser);
  TimeUnitKeywordsContext.prototype.copyFrom.call(this, ctx);
  return this;
}

TimeUnitSecondsContext.prototype = Object.create(TimeUnitKeywordsContext.prototype);
TimeUnitSecondsContext.prototype.constructor = TimeUnitSecondsContext;

ScrollQLParser.TimeUnitSecondsContext = TimeUnitSecondsContext;

TimeUnitSecondsContext.prototype.K_TU_S = function() {
  return this.getToken(ScrollQLParser.K_TU_S, 0);
};

TimeUnitSecondsContext.prototype.K_TU_SEC = function() {
  return this.getToken(ScrollQLParser.K_TU_SEC, 0);
};

TimeUnitSecondsContext.prototype.K_TU_SECOND = function() {
  return this.getToken(ScrollQLParser.K_TU_SECOND, 0);
};
TimeUnitSecondsContext.prototype.enterRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.enterTimeUnitSeconds(this);
  }
};

TimeUnitSecondsContext.prototype.exitRule = function(listener) {
  if (listener instanceof ScrollQLParserListener) {
    listener.exitTimeUnitSeconds(this);
  }
};

ScrollQLParser.TimeUnitKeywordsContext = TimeUnitKeywordsContext;

ScrollQLParser.prototype.timeUnitKeywords = function() {
  var localctx = new TimeUnitKeywordsContext(this, this._ctx, this.state);
  this.enterRule(localctx, 112, ScrollQLParser.RULE_timeUnitKeywords);
  var _la = 0; // Token type
  try {
    this.state = 575;
    this._errHandler.sync(this);
    switch (this._input.LA(1)) {
      case ScrollQLParser.K_TU_MS:
      case ScrollQLParser.K_TU_MSEC:
      case ScrollQLParser.K_TU_MSECOND:
        localctx = new TimeUnitMilliSecondsContext(this, localctx);
        this.enterOuterAlt(localctx, 1);
        this.state = 566;
        _la = this._input.LA(1);
        if (
          !(
            ((_la - 31) & ~0x1f) == 0 &&
            ((1 << (_la - 31)) &
              ((1 << (ScrollQLParser.K_TU_MS - 31)) |
                (1 << (ScrollQLParser.K_TU_MSEC - 31)) |
                (1 << (ScrollQLParser.K_TU_MSECOND - 31)))) !==
              0
          )
        ) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.K_TU_S:
      case ScrollQLParser.K_TU_SEC:
      case ScrollQLParser.K_TU_SECOND:
        localctx = new TimeUnitSecondsContext(this, localctx);
        this.enterOuterAlt(localctx, 2);
        this.state = 567;
        _la = this._input.LA(1);
        if (
          !(
            ((_la - 34) & ~0x1f) == 0 &&
            ((1 << (_la - 34)) &
              ((1 << (ScrollQLParser.K_TU_S - 34)) |
                (1 << (ScrollQLParser.K_TU_SEC - 34)) |
                (1 << (ScrollQLParser.K_TU_SECOND - 34)))) !==
              0
          )
        ) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.K_TU_M:
      case ScrollQLParser.K_TU_MIN:
      case ScrollQLParser.K_TU_MINUTE:
        localctx = new TimeUnitMinutesContext(this, localctx);
        this.enterOuterAlt(localctx, 3);
        this.state = 568;
        _la = this._input.LA(1);
        if (
          !(
            ((_la - 37) & ~0x1f) == 0 &&
            ((1 << (_la - 37)) &
              ((1 << (ScrollQLParser.K_TU_M - 37)) |
                (1 << (ScrollQLParser.K_TU_MIN - 37)) |
                (1 << (ScrollQLParser.K_TU_MINUTE - 37)))) !==
              0
          )
        ) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.K_TU_H:
      case ScrollQLParser.K_TU_HR:
      case ScrollQLParser.K_TU_HOUR:
        localctx = new TimeUnitHoursContext(this, localctx);
        this.enterOuterAlt(localctx, 4);
        this.state = 569;
        _la = this._input.LA(1);
        if (
          !(
            ((_la - 40) & ~0x1f) == 0 &&
            ((1 << (_la - 40)) &
              ((1 << (ScrollQLParser.K_TU_H - 40)) |
                (1 << (ScrollQLParser.K_TU_HR - 40)) |
                (1 << (ScrollQLParser.K_TU_HOUR - 40)))) !==
              0
          )
        ) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.K_TU_D:
      case ScrollQLParser.K_TU_DAY:
        localctx = new TimeUnitDaysContext(this, localctx);
        this.enterOuterAlt(localctx, 5);
        this.state = 570;
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.K_TU_D || _la === ScrollQLParser.K_TU_DAY)) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.K_TU_W:
      case ScrollQLParser.K_TU_WEEK:
        localctx = new TimeUnitWeeksContext(this, localctx);
        this.enterOuterAlt(localctx, 6);
        this.state = 571;
        _la = this._input.LA(1);
        if (!(_la === ScrollQLParser.K_TU_W || _la === ScrollQLParser.K_TU_WEEK)) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.K_TU_MO:
      case ScrollQLParser.K_TU_MON:
      case ScrollQLParser.K_TU_MONTH:
        localctx = new TimeUnitMonthsContext(this, localctx);
        this.enterOuterAlt(localctx, 7);
        this.state = 572;
        _la = this._input.LA(1);
        if (
          !(
            ((_la - 47) & ~0x1f) == 0 &&
            ((1 << (_la - 47)) &
              ((1 << (ScrollQLParser.K_TU_MO - 47)) |
                (1 << (ScrollQLParser.K_TU_MON - 47)) |
                (1 << (ScrollQLParser.K_TU_MONTH - 47)))) !==
              0
          )
        ) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.K_TU_Q:
      case ScrollQLParser.K_TU_QTR:
      case ScrollQLParser.K_TU_QUARTER:
        localctx = new TimeUnitQuartersContext(this, localctx);
        this.enterOuterAlt(localctx, 8);
        this.state = 573;
        _la = this._input.LA(1);
        if (
          !(
            ((_la - 50) & ~0x1f) == 0 &&
            ((1 << (_la - 50)) &
              ((1 << (ScrollQLParser.K_TU_Q - 50)) |
                (1 << (ScrollQLParser.K_TU_QTR - 50)) |
                (1 << (ScrollQLParser.K_TU_QUARTER - 50)))) !==
              0
          )
        ) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      case ScrollQLParser.K_TU_Y:
      case ScrollQLParser.K_TU_YR:
      case ScrollQLParser.K_TU_YEAR:
        localctx = new TimeUnitYearsContext(this, localctx);
        this.enterOuterAlt(localctx, 9);
        this.state = 574;
        _la = this._input.LA(1);
        if (
          !(
            ((_la - 53) & ~0x1f) == 0 &&
            ((1 << (_la - 53)) &
              ((1 << (ScrollQLParser.K_TU_Y - 53)) |
                (1 << (ScrollQLParser.K_TU_YR - 53)) |
                (1 << (ScrollQLParser.K_TU_YEAR - 53)))) !==
              0
          )
        ) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
        break;
      default:
        throw new antlr4.error.NoViableAltException(this);
    }
  } catch (re) {
    if (re instanceof antlr4.error.RecognitionException) {
      localctx.exception = re;
      this._errHandler.reportError(this, re);
      this._errHandler.recover(this, re);
    } else {
      throw re;
    }
  } finally {
    this.exitRule();
  }
  return localctx;
};

ScrollQLParser.prototype.sempred = function(localctx, ruleIndex, predIndex) {
  switch (ruleIndex) {
    case 22:
      return this.searchExpr_sempred(localctx, predIndex);
    case 29:
      return this.expression_sempred(localctx, predIndex);
    default:
      throw 'No predicate with index:' + ruleIndex;
  }
};

ScrollQLParser.prototype.searchExpr_sempred = function(localctx, predIndex) {
  switch (predIndex) {
    case 0:
      return this.precpred(this._ctx, 3);
    case 1:
      return this.precpred(this._ctx, 2);
    default:
      throw 'No predicate with index:' + predIndex;
  }
};

ScrollQLParser.prototype.expression_sempred = function(localctx, predIndex) {
  switch (predIndex) {
    case 2:
      return this.precpred(this._ctx, 13);
    case 3:
      return this.precpred(this._ctx, 9);
    case 4:
      return this.precpred(this._ctx, 8);
    case 5:
      return this.precpred(this._ctx, 7);
    case 6:
      return this.precpred(this._ctx, 6);
    case 7:
      return this.precpred(this._ctx, 3);
    case 8:
      return this.precpred(this._ctx, 2);
    case 9:
      return this.precpred(this._ctx, 5);
    case 10:
      return this.precpred(this._ctx, 4);
    default:
      throw 'No predicate with index:' + predIndex;
  }
};

exports.ScrollQLParser = ScrollQLParser;
