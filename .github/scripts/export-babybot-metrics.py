#!/usr/bin/env python3
"""
Export BabyBot usability review metrics from GitHub
Usage: python export-babybot-metrics.py [--format csv|json] [--output filename]
"""
import subprocess
import json
import csv
import argparse
from datetime import datetime
from collections import defaultdict

def get_prs_with_usability_review_label():
    """Get all PRs with the usability-review label"""
    cmd = [
        'gh', 'api', 'repos/grafana/grafana/issues',
        '--paginate',
        '-f', 'state=all',
        '-f', 'labels=usability-review',
        '--jq', '.[] | .number'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    pr_numbers = []
    for line in result.stdout.strip().split('\n'):
        if line:
            try:
                pr_numbers.append(line.strip())
            except:
                continue

    return pr_numbers

def get_review_comments(pr_numbers):
    """Get all BabyBot review comments (resolvable ones) from specific PRs"""
    comments = []

    for pr_number in pr_numbers:
        cmd = [
            'gh', 'api', f'repos/grafana/grafana/pulls/{pr_number}/comments',
            '--jq', '''
            .[] |
            select(.body | contains("BabyBot 🍼")) |
            {
                id: .id,
                pr_number: (.pull_request_url | split("/") | .[-1]),
                file: .path,
                line: .line,
                created_at: .created_at,
                updated_at: .updated_at,
                body: .body,
                html_url: .html_url,
                reactions: .reactions,
                in_reply_to_id: .in_reply_to_id
            }
            '''
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        for line in result.stdout.strip().split('\n'):
            if line:
                try:
                    comments.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    return comments

def get_general_comments(pr_numbers):
    """Get BabyBot general comments (fallback ones) from specific PRs"""
    comments = []

    for pr_number in pr_numbers:
        cmd = [
            'gh', 'api', f'repos/grafana/grafana/issues/{pr_number}/comments',
            '--jq', '''
            .[] |
            select(.body | contains("BabyBot 🍼")) |
            {
                id: .id,
                pr_number: (.html_url | split("/") | .[-3]),
                created_at: .created_at,
                updated_at: .updated_at,
                body: .body,
                html_url: .html_url,
                reactions: .reactions
            }
            '''
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        for line in result.stdout.strip().split('\n'):
            if line:
                try:
                    comments.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    return comments

def extract_severity(body):
    """Extract severity from comment body"""
    if '‼️ Critical' in body:
        return 'Critical'
    elif '⚠️ Major' in body:
        return 'Major'
    elif '🟢 Minor' in body:
        return 'Minor'
    return 'Unknown'

def extract_confidence(body):
    """Extract confidence level from comment body"""
    import re
    match = re.search(r'\*\*Confidence:\*\*\s*(Low|Medium|High)', body)
    return match.group(1) if match else 'Unknown'

def get_replies_to_comment(pr_number, comment_id):
    """Get all replies to a specific comment"""
    cmd = [
        'gh', 'api', f'repos/grafana/grafana/pulls/{pr_number}/comments',
        '--jq', f'.[] | select(.in_reply_to_id == {comment_id})'
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        replies = []
        for line in result.stdout.strip().split('\n'):
            if line:
                try:
                    replies.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return replies
    except:
        return []

def calculate_engagement_score(comment):
    """Calculate engagement score based on reactions and replies"""
    reactions = comment.get('reactions', {})

    # Count all reaction types
    total_reactions = 0
    if isinstance(reactions, dict):
        total_reactions = reactions.get('total_count', 0)
        # Weight certain reactions more heavily
        engagement_reactions = (
            reactions.get('+1', 0) +        # thumbs up
            reactions.get('hooray', 0) +    # party
            reactions.get('heart', 0)       # heart
        )

    # Check if there are replies
    has_reply = comment.get('in_reply_to_id') is not None

    # Simple engagement score: reactions + bonus for replies
    score = total_reactions + (5 if has_reply else 0)

    return {
        'total_reactions': total_reactions,
        'engagement_reactions': engagement_reactions,
        'has_reply': has_reply,
        'score': score
    }

def aggregate_metrics(review_comments, general_comments):
    """Aggregate metrics by PR and severity"""
    metrics = {
        'total_comments': len(review_comments) + len(general_comments),
        'resolvable_comments': len(review_comments),
        'general_comments': len(general_comments),
        'by_pr': defaultdict(lambda: {'count': 0, 'severities': defaultdict(int), 'engaged': 0}),
        'by_severity': defaultdict(int),
        'by_confidence': defaultdict(int),
        'engagement': {
            'comments_with_reactions': 0,
            'comments_with_replies': 0,
            'total_reactions': 0,
            'avg_reactions_per_comment': 0,
            'engagement_rate': 0
        },
        'export_date': datetime.now().isoformat()
    }

    all_comments = review_comments + general_comments

    total_reactions = 0
    comments_with_reactions = 0
    comments_with_replies = 0

    for comment in all_comments:
        pr_num = comment['pr_number']
        severity = extract_severity(comment['body'])
        confidence = extract_confidence(comment['body'])

        # Calculate engagement
        engagement = calculate_engagement_score(comment)

        metrics['by_pr'][pr_num]['count'] += 1
        metrics['by_pr'][pr_num]['severities'][severity] += 1
        metrics['by_severity'][severity] += 1
        metrics['by_confidence'][confidence] += 1

        # Track engagement
        if engagement['total_reactions'] > 0:
            comments_with_reactions += 1
            total_reactions += engagement['total_reactions']
            metrics['by_pr'][pr_num]['engaged'] += 1

        if engagement['has_reply']:
            comments_with_replies += 1

    # Calculate engagement metrics
    total = len(all_comments)
    metrics['engagement']['comments_with_reactions'] = comments_with_reactions
    metrics['engagement']['comments_with_replies'] = comments_with_replies
    metrics['engagement']['total_reactions'] = total_reactions
    metrics['engagement']['avg_reactions_per_comment'] = round(total_reactions / total, 2) if total > 0 else 0
    metrics['engagement']['engagement_rate'] = round((comments_with_reactions / total) * 100, 1) if total > 0 else 0

    return metrics

def export_to_csv(metrics, review_comments, general_comments, filename):
    """Export detailed metrics to CSV"""
    all_comments = review_comments + general_comments

    with open(filename, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'comment_id', 'pr_number', 'comment_type', 'severity',
            'confidence', 'file', 'created_at', 'url', 'total_reactions',
            'has_reply', 'engagement_score'
        ])
        writer.writeheader()

        for comment in all_comments:
            engagement = calculate_engagement_score(comment)

            writer.writerow({
                'comment_id': comment['id'],
                'pr_number': comment['pr_number'],
                'comment_type': 'resolvable' if 'file' in comment else 'general',
                'severity': extract_severity(comment['body']),
                'confidence': extract_confidence(comment['body']),
                'file': comment.get('file', 'N/A'),
                'created_at': comment['created_at'],
                'url': comment['html_url'],
                'total_reactions': engagement['total_reactions'],
                'has_reply': engagement['has_reply'],
                'engagement_score': engagement['score']
            })

    print(f"✅ Exported detailed metrics to {filename}")

def export_to_json(metrics, filename):
    """Export aggregated metrics to JSON"""
    with open(filename, 'w') as f:
        json.dump(metrics, f, indent=2)

    print(f"✅ Exported aggregated metrics to {filename}")

def print_summary(metrics):
    """Print summary to console"""
    print("\n📊 BabyBot Usability Review Metrics")
    print("=" * 50)
    print(f"Total Comments: {metrics['total_comments']}")
    print(f"  - Resolvable (on files): {metrics['resolvable_comments']}")
    print(f"  - General: {metrics['general_comments']}")
    print(f"\nBy Severity:")
    for severity, count in metrics['by_severity'].items():
        print(f"  - {severity}: {count}")
    print(f"\nBy Confidence:")
    for confidence, count in metrics['by_confidence'].items():
        print(f"  - {confidence}: {count}")
    print(f"\nEngagement:")
    eng = metrics['engagement']
    print(f"  - Comments with reactions: {eng['comments_with_reactions']}")
    print(f"  - Comments with replies: {eng['comments_with_replies']}")
    print(f"  - Total reactions: {eng['total_reactions']}")
    print(f"  - Avg reactions per comment: {eng['avg_reactions_per_comment']}")
    print(f"  - Engagement rate: {eng['engagement_rate']}%")
    print(f"\nPRs Reviewed: {len(metrics['by_pr'])}")
    print("=" * 50)

def main():
    parser = argparse.ArgumentParser(description='Export BabyBot metrics')
    parser.add_argument('--format', choices=['csv', 'json', 'both'], default='both',
                       help='Export format (default: both)')
    parser.add_argument('--output', default='babybot-metrics',
                       help='Output filename (without extension)')

    args = parser.parse_args()

    print("🔍 Fetching PRs with 'usability-review' label...")
    pr_numbers = get_prs_with_usability_review_label()
    print(f"Found {len(pr_numbers)} PRs with usability-review label")

    if not pr_numbers:
        print("No PRs found with usability-review label. Exiting.")
        return

    print("\n🔍 Fetching BabyBot comments from those PRs...")
    review_comments = get_review_comments(pr_numbers)
    general_comments = get_general_comments(pr_numbers)

    print(f"Found {len(review_comments)} review comments and {len(general_comments)} general comments")

    print("\n📈 Aggregating metrics...")
    metrics = aggregate_metrics(review_comments, general_comments)

    print_summary(metrics)

    if args.format in ['csv', 'both']:
        export_to_csv(metrics, review_comments, general_comments, f"{args.output}.csv")

    if args.format in ['json', 'both']:
        export_to_json(metrics, f"{args.output}.json")

    print("\n✨ Done!")

if __name__ == '__main__':
    main()
