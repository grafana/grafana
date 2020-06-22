// Generated from ScrollQLParser.g4 by ANTLR 4.8
// jshint ignore: start
var antlr4 = require('antlr4/index');

// This class defines a complete listener for a parse tree produced by ScrollQLParser.
function ScrollQLParserListener() {
  antlr4.tree.ParseTreeListener.call(this);
  return this;
}

ScrollQLParserListener.prototype = Object.create(antlr4.tree.ParseTreeListener.prototype);
ScrollQLParserListener.prototype.constructor = ScrollQLParserListener;

// Enter a parse tree produced by ScrollQLParser#query.
ScrollQLParserListener.prototype.enterQuery = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#query.
ScrollQLParserListener.prototype.exitQuery = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logQuery.
ScrollQLParserListener.prototype.enterLogQuery = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logQuery.
ScrollQLParserListener.prototype.exitLogQuery = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logAesthetic.
ScrollQLParserListener.prototype.enterLogAesthetic = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logAesthetic.
ScrollQLParserListener.prototype.exitLogAesthetic = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logSourceStage.
ScrollQLParserListener.prototype.enterLogSourceStage = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logSourceStage.
ScrollQLParserListener.prototype.exitLogSourceStage = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logStatsStage.
ScrollQLParserListener.prototype.enterLogStatsStage = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logStatsStage.
ScrollQLParserListener.prototype.exitLogStatsStage = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logOp.
ScrollQLParserListener.prototype.enterLogOp = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logOp.
ScrollQLParserListener.prototype.exitLogOp = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logAestheticOp.
ScrollQLParserListener.prototype.enterLogAestheticOp = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logAestheticOp.
ScrollQLParserListener.prototype.exitLogAestheticOp = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logSource.
ScrollQLParserListener.prototype.enterLogSource = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logSource.
ScrollQLParserListener.prototype.exitLogSource = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeExpr.
ScrollQLParserListener.prototype.enterTimeExpr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeExpr.
ScrollQLParserListener.prototype.exitTimeExpr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#nowTimeExpr.
ScrollQLParserListener.prototype.enterNowTimeExpr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#nowTimeExpr.
ScrollQLParserListener.prototype.exitNowTimeExpr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#negRelativeTimeExpr.
ScrollQLParserListener.prototype.enterNegRelativeTimeExpr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#negRelativeTimeExpr.
ScrollQLParserListener.prototype.exitNegRelativeTimeExpr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#posRelativeTimeExpr.
ScrollQLParserListener.prototype.enterPosRelativeTimeExpr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#posRelativeTimeExpr.
ScrollQLParserListener.prototype.exitPosRelativeTimeExpr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#iso8601TimeExpr.
ScrollQLParserListener.prototype.enterIso8601TimeExpr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#iso8601TimeExpr.
ScrollQLParserListener.prototype.exitIso8601TimeExpr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#epochTimeExpr.
ScrollQLParserListener.prototype.enterEpochTimeExpr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#epochTimeExpr.
ScrollQLParserListener.prototype.exitEpochTimeExpr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#bareSpaceDelimited.
ScrollQLParserListener.prototype.enterBareSpaceDelimited = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#bareSpaceDelimited.
ScrollQLParserListener.prototype.exitBareSpaceDelimited = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logStats.
ScrollQLParserListener.prototype.enterLogStats = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logStats.
ScrollQLParserListener.prototype.exitLogStats = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#statsExpr.
ScrollQLParserListener.prototype.enterStatsExpr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#statsExpr.
ScrollQLParserListener.prototype.exitStatsExpr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#statsGroupFieldId.
ScrollQLParserListener.prototype.enterStatsGroupFieldId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#statsGroupFieldId.
ScrollQLParserListener.prototype.exitStatsGroupFieldId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#statsGroupFieldProjection.
ScrollQLParserListener.prototype.enterStatsGroupFieldProjection = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#statsGroupFieldProjection.
ScrollQLParserListener.prototype.exitStatsGroupFieldProjection = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logOpFieldsFields.
ScrollQLParserListener.prototype.enterLogOpFieldsFields = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logOpFieldsFields.
ScrollQLParserListener.prototype.exitLogOpFieldsFields = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logOpFieldsDisplay.
ScrollQLParserListener.prototype.enterLogOpFieldsDisplay = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logOpFieldsDisplay.
ScrollQLParserListener.prototype.exitLogOpFieldsDisplay = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#fieldSpec.
ScrollQLParserListener.prototype.enterFieldSpec = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#fieldSpec.
ScrollQLParserListener.prototype.exitFieldSpec = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logOpParse.
ScrollQLParserListener.prototype.enterLogOpParse = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logOpParse.
ScrollQLParserListener.prototype.exitLogOpParse = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logOpSearch.
ScrollQLParserListener.prototype.enterLogOpSearch = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logOpSearch.
ScrollQLParserListener.prototype.exitLogOpSearch = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#implicitLogOpSearch.
ScrollQLParserListener.prototype.enterImplicitLogOpSearch = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#implicitLogOpSearch.
ScrollQLParserListener.prototype.exitImplicitLogOpSearch = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#searchExprTerm.
ScrollQLParserListener.prototype.enterSearchExprTerm = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#searchExprTerm.
ScrollQLParserListener.prototype.exitSearchExprTerm = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#searchExprNot.
ScrollQLParserListener.prototype.enterSearchExprNot = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#searchExprNot.
ScrollQLParserListener.prototype.exitSearchExprNot = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#searchExprAnd.
ScrollQLParserListener.prototype.enterSearchExprAnd = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#searchExprAnd.
ScrollQLParserListener.prototype.exitSearchExprAnd = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#searchExprNested.
ScrollQLParserListener.prototype.enterSearchExprNested = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#searchExprNested.
ScrollQLParserListener.prototype.exitSearchExprNested = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#searchExprOr.
ScrollQLParserListener.prototype.enterSearchExprOr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#searchExprOr.
ScrollQLParserListener.prototype.exitSearchExprOr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#searchTerm.
ScrollQLParserListener.prototype.enterSearchTerm = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#searchTerm.
ScrollQLParserListener.prototype.exitSearchTerm = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logOpFilter.
ScrollQLParserListener.prototype.enterLogOpFilter = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logOpFilter.
ScrollQLParserListener.prototype.exitLogOpFilter = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logOpSort.
ScrollQLParserListener.prototype.enterLogOpSort = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logOpSort.
ScrollQLParserListener.prototype.exitLogOpSort = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#sortExprDesc.
ScrollQLParserListener.prototype.enterSortExprDesc = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#sortExprDesc.
ScrollQLParserListener.prototype.exitSortExprDesc = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#sortExprAsc.
ScrollQLParserListener.prototype.enterSortExprAsc = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#sortExprAsc.
ScrollQLParserListener.prototype.exitSortExprAsc = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logOpLimitHead.
ScrollQLParserListener.prototype.enterLogOpLimitHead = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logOpLimitHead.
ScrollQLParserListener.prototype.exitLogOpLimitHead = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logOpLimitTail.
ScrollQLParserListener.prototype.enterLogOpLimitTail = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logOpLimitTail.
ScrollQLParserListener.prototype.exitLogOpLimitTail = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionRoot.
ScrollQLParserListener.prototype.enterExpressionRoot = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionRoot.
ScrollQLParserListener.prototype.exitExpressionRoot = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionAddSub.
ScrollQLParserListener.prototype.enterExpressionAddSub = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionAddSub.
ScrollQLParserListener.prototype.exitExpressionAddSub = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionEq.
ScrollQLParserListener.prototype.enterExpressionEq = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionEq.
ScrollQLParserListener.prototype.exitExpressionEq = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionComp.
ScrollQLParserListener.prototype.enterExpressionComp = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionComp.
ScrollQLParserListener.prototype.exitExpressionComp = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionExpo.
ScrollQLParserListener.prototype.enterExpressionExpo = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionExpo.
ScrollQLParserListener.prototype.exitExpressionExpo = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionLike.
ScrollQLParserListener.prototype.enterExpressionLike = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionLike.
ScrollQLParserListener.prototype.exitExpressionLike = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionTerm.
ScrollQLParserListener.prototype.enterExpressionTerm = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionTerm.
ScrollQLParserListener.prototype.exitExpressionTerm = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionNeg.
ScrollQLParserListener.prototype.enterExpressionNeg = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionNeg.
ScrollQLParserListener.prototype.exitExpressionNeg = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionNot.
ScrollQLParserListener.prototype.enterExpressionNot = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionNot.
ScrollQLParserListener.prototype.exitExpressionNot = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionPos.
ScrollQLParserListener.prototype.enterExpressionPos = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionPos.
ScrollQLParserListener.prototype.exitExpressionPos = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionMulDivMod.
ScrollQLParserListener.prototype.enterExpressionMulDivMod = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionMulDivMod.
ScrollQLParserListener.prototype.exitExpressionMulDivMod = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionAnd.
ScrollQLParserListener.prototype.enterExpressionAnd = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionAnd.
ScrollQLParserListener.prototype.exitExpressionAnd = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionNested.
ScrollQLParserListener.prototype.enterExpressionNested = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionNested.
ScrollQLParserListener.prototype.exitExpressionNested = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionOr.
ScrollQLParserListener.prototype.enterExpressionOr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionOr.
ScrollQLParserListener.prototype.exitExpressionOr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#expressionIn.
ScrollQLParserListener.prototype.enterExpressionIn = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#expressionIn.
ScrollQLParserListener.prototype.exitExpressionIn = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#termId.
ScrollQLParserListener.prototype.enterTermId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#termId.
ScrollQLParserListener.prototype.exitTermId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#termNum.
ScrollQLParserListener.prototype.enterTermNum = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#termNum.
ScrollQLParserListener.prototype.exitTermNum = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#termStr.
ScrollQLParserListener.prototype.enterTermStr = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#termStr.
ScrollQLParserListener.prototype.exitTermStr = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#termFn.
ScrollQLParserListener.prototype.enterTermFn = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#termFn.
ScrollQLParserListener.prototype.exitTermFn = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#likeTerm.
ScrollQLParserListener.prototype.enterLikeTerm = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#likeTerm.
ScrollQLParserListener.prototype.exitLikeTerm = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#functionWithArgs.
ScrollQLParserListener.prototype.enterFunctionWithArgs = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#functionWithArgs.
ScrollQLParserListener.prototype.exitFunctionWithArgs = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#functionWithNoArgs.
ScrollQLParserListener.prototype.enterFunctionWithNoArgs = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#functionWithNoArgs.
ScrollQLParserListener.prototype.exitFunctionWithNoArgs = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#functionArgTimePeriod.
ScrollQLParserListener.prototype.enterFunctionArgTimePeriod = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#functionArgTimePeriod.
ScrollQLParserListener.prototype.exitFunctionArgTimePeriod = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#functionArgFieldClause.
ScrollQLParserListener.prototype.enterFunctionArgFieldClause = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#functionArgFieldClause.
ScrollQLParserListener.prototype.exitFunctionArgFieldClause = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#array.
ScrollQLParserListener.prototype.enterArray = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#array.
ScrollQLParserListener.prototype.exitArray = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#arrayElem.
ScrollQLParserListener.prototype.enterArrayElem = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#arrayElem.
ScrollQLParserListener.prototype.exitArrayElem = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#number.
ScrollQLParserListener.prototype.enterNumber = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#number.
ScrollQLParserListener.prototype.exitNumber = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#string.
ScrollQLParserListener.prototype.enterString = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#string.
ScrollQLParserListener.prototype.exitString = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#stringOrBareString.
ScrollQLParserListener.prototype.enterStringOrBareString = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#stringOrBareString.
ScrollQLParserListener.prototype.exitStringOrBareString = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#regex.
ScrollQLParserListener.prototype.enterRegex = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#regex.
ScrollQLParserListener.prototype.exitRegex = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#regexString.
ScrollQLParserListener.prototype.enterRegexString = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#regexString.
ScrollQLParserListener.prototype.exitRegexString = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#logId.
ScrollQLParserListener.prototype.enterLogId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#logId.
ScrollQLParserListener.prototype.exitLogId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#fieldId.
ScrollQLParserListener.prototype.enterFieldId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#fieldId.
ScrollQLParserListener.prototype.exitFieldId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#aliasId.
ScrollQLParserListener.prototype.enterAliasId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#aliasId.
ScrollQLParserListener.prototype.exitAliasId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#userId.
ScrollQLParserListener.prototype.enterUserId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#userId.
ScrollQLParserListener.prototype.exitUserId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#unquotedUserId.
ScrollQLParserListener.prototype.enterUnquotedUserId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#unquotedUserId.
ScrollQLParserListener.prototype.exitUnquotedUserId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#unquotedUserAtId.
ScrollQLParserListener.prototype.enterUnquotedUserAtId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#unquotedUserAtId.
ScrollQLParserListener.prototype.exitUnquotedUserAtId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#unquotedUserBareId.
ScrollQLParserListener.prototype.enterUnquotedUserBareId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#unquotedUserBareId.
ScrollQLParserListener.prototype.exitUnquotedUserBareId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#quotedUserId.
ScrollQLParserListener.prototype.enterQuotedUserId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#quotedUserId.
ScrollQLParserListener.prototype.exitQuotedUserId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#systemId.
ScrollQLParserListener.prototype.enterSystemId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#systemId.
ScrollQLParserListener.prototype.exitSystemId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#unquotedSystemId.
ScrollQLParserListener.prototype.enterUnquotedSystemId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#unquotedSystemId.
ScrollQLParserListener.prototype.exitUnquotedSystemId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#quotedSystemId.
ScrollQLParserListener.prototype.enterQuotedSystemId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#quotedSystemId.
ScrollQLParserListener.prototype.exitQuotedSystemId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#resultId.
ScrollQLParserListener.prototype.enterResultId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#resultId.
ScrollQLParserListener.prototype.exitResultId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#functionId.
ScrollQLParserListener.prototype.enterFunctionId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#functionId.
ScrollQLParserListener.prototype.exitFunctionId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#rawId.
ScrollQLParserListener.prototype.enterRawId = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#rawId.
ScrollQLParserListener.prototype.exitRawId = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#keywords.
ScrollQLParserListener.prototype.enterKeywords = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#keywords.
ScrollQLParserListener.prototype.exitKeywords = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeUnitMilliSeconds.
ScrollQLParserListener.prototype.enterTimeUnitMilliSeconds = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeUnitMilliSeconds.
ScrollQLParserListener.prototype.exitTimeUnitMilliSeconds = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeUnitSeconds.
ScrollQLParserListener.prototype.enterTimeUnitSeconds = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeUnitSeconds.
ScrollQLParserListener.prototype.exitTimeUnitSeconds = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeUnitMinutes.
ScrollQLParserListener.prototype.enterTimeUnitMinutes = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeUnitMinutes.
ScrollQLParserListener.prototype.exitTimeUnitMinutes = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeUnitHours.
ScrollQLParserListener.prototype.enterTimeUnitHours = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeUnitHours.
ScrollQLParserListener.prototype.exitTimeUnitHours = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeUnitDays.
ScrollQLParserListener.prototype.enterTimeUnitDays = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeUnitDays.
ScrollQLParserListener.prototype.exitTimeUnitDays = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeUnitWeeks.
ScrollQLParserListener.prototype.enterTimeUnitWeeks = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeUnitWeeks.
ScrollQLParserListener.prototype.exitTimeUnitWeeks = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeUnitMonths.
ScrollQLParserListener.prototype.enterTimeUnitMonths = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeUnitMonths.
ScrollQLParserListener.prototype.exitTimeUnitMonths = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeUnitQuarters.
ScrollQLParserListener.prototype.enterTimeUnitQuarters = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeUnitQuarters.
ScrollQLParserListener.prototype.exitTimeUnitQuarters = function(ctx) {};

// Enter a parse tree produced by ScrollQLParser#timeUnitYears.
ScrollQLParserListener.prototype.enterTimeUnitYears = function(ctx) {};

// Exit a parse tree produced by ScrollQLParser#timeUnitYears.
ScrollQLParserListener.prototype.exitTimeUnitYears = function(ctx) {};

exports.ScrollQLParserListener = ScrollQLParserListener;
